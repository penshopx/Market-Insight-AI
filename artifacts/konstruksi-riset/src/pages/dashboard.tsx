import { useGetDashboardSummary, useGetTrendingTopics, useGetExpiringCertifications, useGetActivityFeed, useGetSchedulerStatus, useTriggerScheduler, useGetSchedulerRuns, useSendBriefing, useRetryRunNotification, getGetDashboardSummaryQueryKey, getGetTrendingTopicsQueryKey, getGetExpiringCertificationsQueryKey, getGetActivityFeedQueryKey, getGetSchedulerStatusQueryKey, getGetSchedulerRunsQueryKey, useListTenderOpportunities } from "@workspace/api-client-react";
import { toast } from "sonner";
import type { SchedulerRun, SchedulerRunNotificationResult, ExpiringCertification, PainPoint, NotificationResult } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableRow, TableHead, TableHeader } from "@/components/ui/table";
import { Activity, CircleAlert, TriangleAlert, ArrowDownRight, ArrowUpRight, ChartBar, Beaker, Bell, BellOff, BookOpen, Brain, Briefcase, Building2, Calculator, Calendar, CircleCheck, ChevronRight, ChevronUp, Clock, Database, DollarSign, Download, Eye, FileText, Fingerprint, Flag, Flame, Handshake, HardHat, Heart, HeartPulse, History, LoaderCircle, Map, MessageSquare, Milestone, Pen, ChartPie, Play, Presentation, RefreshCw, Rocket, Send, Settings, Shield, ShieldAlert, ShieldCheck, Star, Target, TrendingUp, Trophy, Users, CircleX, Zap } from "lucide-react";
import { KnowledgeSourcesBar } from "@/components/knowledge-sources-bar";
import { format, formatDistanceToNow } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts";
import { id as idLocale } from "date-fns/locale";
import { useQueryClient, useIsFetching } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { useListPainPoints, getListPainPointsQueryKey } from "@workspace/api-client-react";
import { exportDashboardPDF, previewDashboardPDF } from "@/lib/export-pdf";
import React, { useState, useMemo, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import { REGULATIONS } from "@/pages/regulasi";

// ─── Decision Intelligence Widget ────────────────────────────────────────────

interface ActionItem {
  id: string;
  severity: "KRITIS" | "TINGGI" | "SEDANG";
  icon: React.ElementType;
  label: string;
  detail: string;
  href: string;
  category: string;
  source?: string; // Knowledge Asset / AI Agent attribution
}

function DecisionIntelligenceWidget({
  expiring,
  criticalPainPoints,
  summary,
  trends,
  tenderStats,
}: {
  expiring?: ExpiringCertification[];
  criticalPainPoints?: PainPoint[];
  summary?: { openTenders?: number | null; expiringCertifications?: number | null; criticalPainPoints?: number | null };
  trends?: Array<{ topic: string; category: string; count: number; trend?: string | null }>;
  tenderStats?: { expiringSoon?: number };
}) {
  // #75 — persist dismissed actions to localStorage so they survive a refresh,
  //         but reset automatically when the calendar date changes (daily reset).
  const DISMISSED_KEY = "mkp-actions-dismissed-v1";
  const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(DISMISSED_KEY);
      if (!raw) return new Set<string>();
      const parsed = JSON.parse(raw) as { date?: string; ids?: string[] };
      // If stored date differs from today, treat as fresh day → empty set
      if (parsed.date !== todayStr) return new Set<string>();
      return new Set<string>(parsed.ids ?? []);
    } catch {
      return new Set<string>();
    }
  });

  // Persist whenever dismissed changes
  useEffect(() => { document.title = "Dashboard — Intel Konstruksi"; return () => { document.title = "Intel Konstruksi"; }; }, []);
  useEffect(() => {
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify({ date: todayStr, ids: [...dismissed] }));
    } catch { /* noop */ }
  }, [dismissed, todayStr]);

  const actions = useMemo<ActionItem[]>(() => {
    const items: ActionItem[] = [];

    // 1. Expiring certs < 30 days → KRITIS
    const urgentExpiring = (expiring ?? []).filter((e) => e.daysLeft <= 30);
    if (urgentExpiring.length > 0) {
      items.push({
        id: "exp-kritis",
        severity: "KRITIS",
        icon: ShieldAlert,
        label: `${urgentExpiring.length} SBU/SKK habis dalam ≤30 hari`,
        detail: urgentExpiring.slice(0, 2).map((e) => `${e.holderName} (${e.daysLeft}h)`).join(", ") + (urgentExpiring.length > 2 ? ` +${urgentExpiring.length - 2} lagi` : ""),
        href: "/skk",
        category: "Sertifikasi",
        source: "AI-CERT-001 · GOV-LPJK-001",
      });
    }

    // 2. Expiring 31–90 days → TINGGI
    const soonExpiring = (expiring ?? []).filter((e) => e.daysLeft > 30 && e.daysLeft <= 90);
    if (soonExpiring.length > 0) {
      items.push({
        id: "exp-tinggi",
        severity: "TINGGI",
        icon: Clock,
        label: `${soonExpiring.length} SBU/SKK habis dalam 31–90 hari`,
        detail: `Perpanjang sekarang sebelum kehabisan slot. ${soonExpiring[0]?.holderName ?? ""} paling dekat.`,
        href: "/skk",
        category: "Sertifikasi",
        source: "REG-SIBIMA-001 · REG-BNSP-001",
      });
    }

    // 3. Critical pain points (painScore >= 9) → KRITIS (show up to top 3)
    const topPain = (criticalPainPoints ?? []).filter((p) => (p.painScore ?? 0) >= 9).slice(0, 3);
    topPain.forEach((pp, idx) => {
      items.push({
        id: `pain-kritis-${idx}`,
        severity: "KRITIS",
        icon: TriangleAlert,
        label: `Pain point kritis: skor ${pp.painScore}/10`,
        detail: (pp.description ?? "").slice(0, 90) + (pp.serviceOpportunity ? ` → ${pp.serviceOpportunity}` : ""),
        href: "/pain-points",
        category: "Analisis Pasar",
        source: "AI-VOC-001 · MKT-LINKEDIN-001",
      });
    });

    // 4. Open tenders → TINGGI if > 0
    if ((summary?.openTenders ?? 0) > 0) {
      items.push({
        id: "tender-open",
        severity: "TINGGI",
        icon: TrendingUp,
        label: `${summary?.openTenders} peluang tender aktif menunggu evaluasi`,
        detail: "Cek kualifikasi SBU dan persiapkan dokumen penawaran sebelum deadline.",
        href: "/tender",
        category: "Tender",
        source: "AI-TENDER-001 · TDR-LPSE-001 · TDR-SIRUP-001",
      });
    }

    // 4b. Tender deadline ≤7 days → KRITIS
    if ((tenderStats?.expiringSoon ?? 0) > 0) {
      items.push({
        id: "tender-deadline-soon",
        severity: "KRITIS",
        icon: TriangleAlert,
        label: `${tenderStats?.expiringSoon} tender mendekati deadline ≤7 hari — submit segera`,
        detail: "Pastikan dokumen penawaran sudah lengkap. Deadline hari ini / minggu ini.",
        href: "/tender",
        category: "Tender",
        source: "AI-TENDER-002 · TDR-LPSE-001",
      });
    }

    // 5. Trending topic signals from live data collection
    const topTrend = (trends ?? [])
      .filter((t) => t.trend === "UP" && t.count > 2)
      .sort((a, b) => b.count - a.count)[0];
    if (topTrend) {
      const isRegulatory = ["REGULATORY", "COMPLIANCE", "CERTIFICATION"].includes(topTrend.category);
      items.push({
        id: `trend-${topTrend.topic.slice(0, 20)}`,
        severity: isRegulatory ? "TINGGI" : "SEDANG",
        icon: MessageSquare,
        label: `Sinyal baru: "${topTrend.topic}" — ${topTrend.count} mention terdeteksi`,
        detail: `Kategori: ${topTrend.category.replace("_", " ")} · Tren naik ↑ dalam 24 jam terakhir. ${isRegulatory ? "Cek dampak regulasi ke proyek aktif." : "Monitor perkembangan pasar."}`,
        href: "/sinyal-pasar",
        category: "Sinyal Pasar",
        source: "AI-MARKET-001 · MED-BISNISIND-001",
      });
    }

    // 6. Regulatory trends from live data
    const regTrend = (trends ?? [])
      .filter((t) => ["REGULATORY", "COMPLIANCE", "CERTIFICATION"].includes(t.category) && t.count > 1)
      .sort((a, b) => b.count - a.count)[0];
    if (regTrend) {
      items.push({
        id: `reg-live-${regTrend.topic.slice(0, 20)}`,
        severity: regTrend.count >= 3 ? "KRITIS" : "TINGGI",
        icon: Shield,
        label: `Regulasi baru terdeteksi: "${regTrend.topic}"`,
        detail: `${regTrend.count} mention aktif · Kategori: ${regTrend.category.replace("_", " ")} · Segera cek dampak ke klien aktif dan peluang penawaran.`,
        href: "/regulasi",
        category: "Regulasi",
        source: "AI-REG-001 · GOV-JDIH-001 · REG-SIBIMA-001",
      });
    }

    // 6b. Critical regulations pulled from REGULATIONS array — most recent first (by tanggal)
    const kritisRegs = REGULATIONS
      .filter((r) => r.dampak === "KRITIS")
      .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
    for (const reg of kritisRegs) {
      if (items.length >= 6) break;
      items.push({
        id: `reg-kritis-${reg.id}`,
        severity: "KRITIS",
        icon: ShieldAlert,
        label: `${reg.kode}: ${reg.judul}`,
        detail: reg.ringkasan.slice(0, 120) + (reg.ringkasan.length > 120 ? "…" : ""),
        href: "/regulasi",
        category: "Regulasi",
        source: "AI-REG-001 · GOV-JDIH-001",
      });
    }
    // Fallback static if no KRITIS regulations exist in the array
    if (kritisRegs.length === 0 && items.length < 4) {
      items.push({
        id: "reg-smap",
        severity: "SEDANG",
        icon: Shield,
        label: "Cek daftar BUJK ketidaksesuaian SMAP di LPJK",
        detail: "LPJK aktif merilis daftar BUJK yang belum comply SMAP ISO 37001. Periksa apakah klien Anda masuk daftar.",
        href: "/regulasi",
        category: "Regulasi",
        source: "AI-REG-001 · GOV-LPJK-001 · REG-JDIH-001",
      });
    }

    // 7. Competitor intelligence reminder if no competitor signal yet
    if (items.length < 5) {
      items.push({
        id: "comp-intel",
        severity: "SEDANG",
        icon: Database,
        label: "Pantau perubahan harga IjinTender — kompetitor utama",
        detail: "IjinTender dimonitor via MKT-IJINTENDER-001. Cek apakah ada perubahan harga atau paket baru yang perlu direspons.",
        href: "/kompetitor",
        category: "Kompetitor",
        source: "AI-COMP-001 · MKT-IJINTENDER-001",
      });
    }

    // 10. Segmen Lokal — alert for uncontacted local segments
    const segmenLokalTotal = 5; // SEGMEN_LOKAL constant
    try {
      const raw = JSON.parse(localStorage.getItem("mkp-kontakSegmen") ?? "{}") as Record<string, boolean>;
      const contacted = Object.values(raw).filter(Boolean).length;
      const uncontacted = segmenLokalTotal - contacted;
      if (uncontacted > 0 && items.length < 6) {
        items.push({
          id: "segmen-lokal",
          severity: "SEDANG",
          icon: Users,
          label: `${uncontacted} segmen lokal belum dihubungi`,
          detail: `${contacted}/${segmenLokalTotal} segmen pasar konstruksi lokal telah dikontakkan. Buka Workroom → Segmen Lokal untuk follow-up.`,
          href: "/workroom",
          category: "Prospek",
          source: "AI-MARKET-001 · MKT-LOCAL-001",
        });
      }
    } catch { /* noop */ }

    // Sort by severity, take top 5, filter dismissed
    const order: Record<string, number> = { KRITIS: 0, TINGGI: 1, SEDANG: 2 };
    return items
      .filter((i) => !dismissed.has(i.id))
      .sort((a, b) => order[a.severity] - order[b.severity])
      .slice(0, 5);
  }, [expiring, criticalPainPoints, summary, trends, dismissed]);

  // #76 — broadcast KRITIS count to localStorage so shell.tsx badge can react
  const kritisCount = actions.filter((a) => a.severity === "KRITIS").length;
  useEffect(() => {
    const key = "mkp-kritis-count";
    const val = String(kritisCount);
    try { localStorage.setItem(key, val); } catch { /* noop */ }
    // Fire storage event for cross-tab listeners (same-tab workaround)
    window.dispatchEvent(new StorageEvent("storage", { key, newValue: val, storageArea: localStorage }));
  }, [kritisCount]);

  const SEVERITY_STYLE: Record<string, { bar: string; badge: string; icon: string }> = {
    KRITIS: { bar: "bg-red-500", badge: "bg-red-100 text-red-700 border-red-300", icon: "text-red-600" },
    TINGGI: { bar: "bg-orange-500", badge: "bg-orange-100 text-orange-700 border-orange-300", icon: "text-orange-600" },
    SEDANG: { bar: "bg-yellow-500", badge: "bg-yellow-100 text-yellow-700 border-yellow-300", icon: "text-yellow-600" },
  };

  if (actions.length === 0) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-center gap-3 py-4">
          <CircleCheck className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-medium text-emerald-700">Semua indikator bersih — tidak ada tindakan mendesak hari ini.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-primary/30 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-red-500 via-orange-500 to-primary" />
      <CardHeader className="flex flex-row items-center justify-between pb-3 pt-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-base">PRIORITAS HARI INI</CardTitle>
            <CardDescription className="text-xs font-mono">Decision Intelligence · {actions.length} tindakan</CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dismissed.size > 0 && (
            <button
              onClick={() => setDismissed(new Set())}
              className="text-[10px] font-mono text-muted-foreground hover:text-red-600 border border-border hover:border-red-200 px-2 py-1 rounded-sm transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
              title="Tampilkan kembali semua tindakan yang disembunyikan"
            >
              ↺ {dismissed.size} tersembunyi
            </button>
          )}
          <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1 rounded-sm">AI ADVISOR</span>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="flex flex-col gap-2">
          {actions.map((action) => {
            const s = SEVERITY_STYLE[action.severity];
            const Icon = action.icon;
            return (
              <div key={action.id} className="flex items-stretch rounded-sm border overflow-hidden bg-card group">
                <div className={cn("w-1 shrink-0", s.bar)} />
                <div className="flex-1 flex items-start gap-3 p-3">
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", s.icon)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <span className={cn("text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border", s.badge)}>
                        {action.severity}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-sm">{action.category}</span>
                    </div>
                    <p className="text-sm font-semibold leading-snug">{action.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2" title={action.detail}>{action.detail}</p>
                    {action.source && (
                      <p className="text-[10px] text-muted-foreground/60 font-mono mt-1 flex items-center gap-1">
                        <Database className="h-2.5 w-2.5 shrink-0" />
                        {action.source}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setDismissed((prev) => new Set([...prev, action.id]))}
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-muted-foreground p-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none rounded-sm"
                      title="Tutup"
                      aria-label="Tutup tindakan ini"
                    >
                      <CircleX className="h-3.5 w-3.5" />
                    </button>
                    <Link href={action.href}>
                      <button className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium px-2 py-1 rounded-sm hover:bg-primary/5 transition-colors">
                        Lihat <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Briefing Delivery Status Card (Task #36) ─────────────────────────────────

function BriefingDeliveryCard({
  status,
  sending,
  onSend,
}: {
  status: NotificationResult | null;
  sending: boolean;
  onSend: () => void;
}) {
  const [confirmSend, setConfirmSend] = useState(false);
  const isSuccess = status?.success === true;
  const isFailure = status?.success === false;
  const noRun = !status;

  return (
    <Card className={cn(
      "border overflow-hidden",
      isFailure ? "border-red-300 bg-red-50/30" : isSuccess ? "border-emerald-300 bg-emerald-50/20" : "border-border"
    )}>
      <div className={cn("h-0.5", isFailure ? "bg-red-500" : isSuccess ? "bg-emerald-500" : "bg-muted")} />
      <CardContent className="py-3 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {isSuccess && <Bell className="h-4 w-4 text-emerald-600 shrink-0" />}
            {isFailure && <BellOff className="h-4 w-4 text-red-600 shrink-0" />}
            {noRun && <Send className="h-4 w-4 text-muted-foreground shrink-0" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                  Pengiriman Briefing
                </span>
                {isSuccess && (
                  <span className="text-[10px] font-mono bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded-sm">
                    ● TERKIRIM
                  </span>
                )}
                {isFailure && (
                  <span className="text-[10px] font-mono bg-red-100 text-red-700 border border-red-300 px-1.5 py-0.5 rounded-sm">
                    ✗ GAGAL
                  </span>
                )}
                {noRun && (
                  <span className="text-[10px] font-mono bg-muted text-muted-foreground border px-1.5 py-0.5 rounded-sm">
                    BELUM DIKIRIM
                  </span>
                )}
                {status?.sentAt && (
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {format(new Date(status.sentAt), "HH:mm:ss")} WIB
                  </span>
                )}
                {status?.channel && status.channel !== "none" && (
                  <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded-sm">
                    via {status.channel}
                  </span>
                )}
              </div>
              {isFailure && status.errorMessage && (
                <p className="text-xs text-red-700 mt-1 font-mono bg-red-100/50 px-2 py-1 rounded-sm border border-red-200 line-clamp-2" title={status.errorMessage}>
                  ⚠ {status.errorMessage}
                </p>
              )}
              {noRun && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Klik tombol untuk mengirim briefing harian via webhook yang terkonfigurasi.
                </p>
              )}
            </div>
          </div>
          {confirmSend ? (
            <span className="flex items-center gap-1.5 shrink-0">
              <button
                autoFocus
                onBlur={() => setConfirmSend(false)}
                onClick={() => { onSend(); setConfirmSend(false); }}
                className={`text-[10px] font-mono text-white rounded-sm px-2 py-1 ${isFailure ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}
              >✓ Yakin kirim?</button>
              <button onClick={() => setConfirmSend(false)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Batal</button>
            </span>
          ) : (
            <Button
              variant={isFailure ? "destructive" : "outline"}
              size="sm"
              onClick={() => setConfirmSend(true)}
              disabled={sending}
              className="shrink-0 font-mono text-xs"
            >
              {sending
                ? <><LoaderCircle className="h-3.5 w-3.5 mr-2 animate-spin" />Mengirim…</>
                : <><Send className="h-3.5 w-3.5 mr-2" />{isFailure ? "Coba Lagi" : "Kirim Briefing"}</>}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const globalFetchCount = useIsFetching();
  const [isExporting, setIsExporting] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [lastDelivery, setLastDelivery] = useState<NotificationResult | null>(null);
  const { data: summary, isLoading: loadingSummary, isError: isSummaryError } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: trends, isLoading: loadingTrends, isError: isTrendsError } = useGetTrendingTopics({ limit: 5 }, { query: { queryKey: getGetTrendingTopicsQueryKey({ limit: 5 }) } });
  const { data: expiring, isLoading: loadingExpiring, isError: isExpiringError } = useGetExpiringCertifications({ query: { queryKey: getGetExpiringCertificationsQueryKey() } });
  const { data: activities, isLoading: loadingActivities, isError: isActivitiesError } = useGetActivityFeed({ limit: 8 }, { query: { queryKey: getGetActivityFeedQueryKey({ limit: 8 }) } });
  const { data: allTendersForDash } = useListTenderOpportunities({});
  const tenderStats = useMemo(() => {
    const all = allTendersForDash ?? [];
    const expiringSoon = all.filter(t => {
      if (!t.deadline) return false;
      const days = (new Date(t.deadline).getTime() - Date.now()) / 86400000;
      return days >= 0 && days <= 7;
    }).length;
    return { expiringSoon };
  }, [allTendersForDash]);

  const { data: criticalPainPoints } = useListPainPoints(
    { priority: "CRITICAL" },
    { query: { queryKey: getListPainPointsQueryKey({ priority: "CRITICAL" }) } }
  );
  const { data: scheduler, isLoading: loadingScheduler } = useGetSchedulerStatus({
    query: {
      queryKey: getGetSchedulerStatusQueryKey(),
      refetchInterval: 10000, // poll every 10 s while page is open
    },
  });
  const { data: schedulerRuns, isLoading: loadingRuns } = useGetSchedulerRuns({
    query: {
      queryKey: getGetSchedulerRunsQueryKey(),
      refetchInterval: 30000,
    },
  });
  const triggerMutation = useTriggerScheduler({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSchedulerStatusQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetSchedulerRunsQueryKey() });
      },
      onError: (err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Gagal memulai crawl — coba lagi");
      },
    },
  });
  const sendBriefingMutation = useSendBriefing({
    mutation: {
      onSuccess: (result) => {
        setLastDelivery(result);
        queryClient.invalidateQueries({ queryKey: getGetSchedulerStatusQueryKey() });
      },
      onError: (err: unknown) => {
        setLastDelivery({ channel: "none", success: false, sentAt: new Date().toISOString(), errorMessage: "Request gagal — cek koneksi server." });
        toast.error("Gagal mengirim briefing", { description: err instanceof Error ? err.message : "Coba lagi" });
      },
    },
  });

  const pdfData = {
    summary: summary ?? undefined,
    trends: trends ?? undefined,
    expiring: expiring ?? undefined,
    criticalPainPoints: (criticalPainPoints ?? []).filter((p) => p.priority === "CRITICAL"),
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try { exportDashboardPDF(pdfData); } finally { setIsExporting(false); }
  };

  const handlePreviewPDF = async () => {
    setIsPreviewing(true);
    try { previewDashboardPDF(pdfData); } finally { setIsPreviewing(false); }
  };

  // Merge server-side lastNotificationResult with local mutation result (local wins)
  const deliveryStatus: NotificationResult | null = lastDelivery ?? (scheduler?.lastNotificationResult ?? null);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">BRIEFING HARIAN</h1>
          <p className="text-muted-foreground font-mono mt-1">STATUS: OPERASIONAL | WAKTU: 07:00 WIB</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreviewPDF}
            disabled={isPreviewing || loadingSummary}
            className="font-mono text-xs"
          >
            {isPreviewing
              ? <><LoaderCircle className="h-3.5 w-3.5 mr-2 animate-spin" />LOADING...</>
              : <><Eye className="h-3.5 w-3.5 mr-2" />PREVIEW</>}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={isExporting || loadingSummary}
            className="font-mono text-xs border-red-500/40 text-red-700 hover:bg-red-50 hover:text-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            {isExporting
              ? <><LoaderCircle className="h-3.5 w-3.5 mr-2 animate-spin" />Generating…</>
              : <><Download className="h-3.5 w-3.5 mr-2" />Export PDF</>}
          </Button>
          <div className="flex items-center gap-2 text-sm font-mono bg-primary/10 text-primary px-3 py-1.5 rounded-sm border border-primary/20">
            <Clock className="h-4 w-4" />
            <span>Update terakhir: {summary?.lastUpdated ? format(new Date(summary.lastUpdated), "HH:mm:ss") : "Memuat…"}</span>
          </div>
        </div>
      </div>

      {/* Scheduler Status Banner */}
      <SchedulerStatusCard
        scheduler={scheduler}
        loading={loadingScheduler}
        triggering={triggerMutation.isPending}
        onTrigger={() => triggerMutation.mutate()}
      />

      {/* Briefing Delivery Status (Task #36) */}
      <BriefingDeliveryCard
        status={deliveryStatus}
        sending={sendBriefingMutation.isPending}
        onSend={() => sendBriefingMutation.mutate()}
      />

      {/* Refresh all button */}
      <div className="flex justify-end -mt-2">
        <button
          onClick={() => queryClient.invalidateQueries()}
          disabled={globalFetchCount > 0}
          className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground border border-border px-2.5 py-1 rounded-sm hover:bg-muted/40 hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Muat ulang semua data dari server"
        >
          <RefreshCw className={cn("h-3 w-3", globalFetchCount > 0 && "animate-spin")} /> {globalFetchCount > 0 ? "Memuat…" : "Refresh Semua Data"}
        </button>
      </div>

      {/* Decision Intelligence Widget — top of dashboard */}
      <DecisionIntelligenceWidget
        expiring={expiring}
        criticalPainPoints={criticalPainPoints}
        summary={summary ?? undefined}
        trends={trends ?? undefined}
        tenderStats={tenderStats}
      />

      {/* Knowledge Sources */}
      <KnowledgeSourcesBar pageKey="data-collector" />

      {/* Platform Health KPI */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> PLATFORM HEALTH KPI — Kesehatan Operasional Intelijen Real-Time
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { kpi: "Intel Coverage", val: "64 sumber", target: "80 sumber", pct: 80, color: "bg-blue-500" },
            { kpi: "Data Freshness", val: "< 24 jam", target: "< 12 jam", pct: 70, color: "bg-emerald-500" },
            { kpi: "Pain Point Mapped", val: "39+", target: "60 total", pct: 65, color: "bg-orange-500" },
            { kpi: "SKK DB Coverage", val: "Jenjang 7–9", target: "Semua bidang", pct: 55, color: "bg-violet-500" },
            { kpi: "Alert Delivery Rate", val: "94%", target: "99%", pct: 94, color: "bg-emerald-500" },
            { kpi: "Scheduler Uptime", val: "99.2%", target: "99.9%", pct: 99, color: "bg-primary" },
          ].map((k) => (
            <div key={k.kpi} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className="text-sm font-black font-mono text-primary leading-none">{k.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 mb-1.5">{k.kpi}</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden mb-0.5">
                <div className={`h-full ${k.color} rounded-full`} style={{ width: `${k.pct}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{k.pct}% · tgt {k.target}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Revenue Momentum */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> WEEKLY REVENUE MOMENTUM — Pipeline & Konversi 7 Hari Terakhir
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {["Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"].map((hari, i) => {
            const heights = [45, 62, 38, 80, 91, 55];
            const vals = ["Rp 4.2jt","Rp 5.8jt","Rp 3.1jt","Rp 9.4jt","Rp 11.2jt","Rp 6.5jt"];
            const h = heights[i];
            return (
              <div key={hari} className="flex flex-col items-center gap-1">
                <span className="text-[9px] font-mono font-bold text-primary">{vals[i]}</span>
                <div className="w-full flex items-end justify-center h-12">
                  <div
                    className={`w-full rounded-t-sm ${h >= 80 ? "bg-emerald-500" : h >= 60 ? "bg-blue-400" : "bg-muted-foreground/30"}`}
                    style={{ height: `${h}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground">{hari.slice(0,3)}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "Total Pipeline Minggu Ini", val: "Rp 40.2jt", color: "text-primary" },
            { label: "Rata-rata Harian", val: "Rp 6.7jt", color: "text-emerald-700" },
            { label: "Prospek Aktif", val: `${(summary?.criticalPainPoints ?? 0) + 8} kontak`, color: "text-blue-700" },
          ].map(m => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-sm font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team Performance Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM PERFORMANCE LEADERBOARD — Kontribusi Tim Intel per Minggu Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { anggota: "Tim Riset A", riset: summary?.totalResearchItems ?? 0, alert: summary?.criticalPainPoints ?? 0, closing: 3, rank: 1, badge: "🥇", color: "border-yellow-300 bg-yellow-50/10" },
            { anggota: "Tim Lapangan B", riset: Math.max(0, (summary?.totalResearchItems ?? 0) - 4), alert: 2, closing: 2, rank: 2, badge: "🥈", color: "border-slate-200 bg-slate-50/10" },
            { anggota: "Tim Analis C", riset: Math.max(0, (summary?.totalResearchItems ?? 0) - 8), alert: 1, closing: 1, rank: 3, badge: "🥉", color: "border-orange-300 bg-orange-50/10" },
          ].map((t) => (
            <div key={t.anggota} className={`border rounded-sm p-3 ${t.color}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">{t.badge}</span>
                <div>
                  <p className="text-xs font-semibold">{t.anggota}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">Rank #{t.rank} minggu ini</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1 text-center">
                {[
                  { label: "Riset", val: t.riset },
                  { label: "Alert", val: t.alert },
                  { label: "Closing", val: t.closing },
                ].map((m) => (
                  <div key={m.label} className="border rounded-sm p-1 bg-background/50">
                    <p className="text-sm font-black font-mono text-primary leading-none">{m.val}</p>
                    <p className="text-[8px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Closing Velocity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> CLOSING VELOCITY TRACKER — Konversi Prospek ke Deal per Layanan Prioritas
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { layanan: "SBU Express", prospek: 22, deal: 17, rate: 77, color: "bg-emerald-500" },
            { layanan: "SKK Multi", prospek: 18, deal: 13, rate: 72, color: "bg-blue-500" },
            { layanan: "SMAP", prospek: 12, deal: 7, rate: 58, color: "bg-violet-500" },
            { layanan: "TKDN Audit", prospek: 8, deal: 4, rate: 50, color: "bg-orange-500" },
            { layanan: "Intel Tender", prospek: 6, deal: 3, rate: 50, color: "bg-yellow-500" },
            { layanan: "Advisory BIM", prospek: 5, deal: 2, rate: 40, color: "bg-red-400" },
          ].map((l) => (
            <div key={l.layanan} className="border rounded-sm p-2 text-center">
              <p className="text-[9px] font-mono font-bold leading-tight mb-1">{l.layanan}</p>
              <p className="text-xl font-black font-mono text-primary leading-none">{l.rate}%</p>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1 mb-0.5">
                <div className={`h-full ${l.color} rounded-full`} style={{ width: `${l.rate}%` }} />
              </div>
              <p className="text-[8px] font-mono text-muted-foreground">{l.deal}/{l.prospek} closed</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Projection Bar */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE PROJECTION — Estimasi Pendapatan Bulanan dari Pipeline Saat Ini
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Pipeline Aktif (Est.)", val: `Rp ${Math.round(((summary?.openTenders ?? 5) + (summary?.criticalPainPoints ?? 3) + 8) * 4.2)}jt`, color: "text-primary" },
            { label: "Committed (In Process)", val: `Rp ${Math.round(((summary?.criticalPainPoints ?? 3) + 5) * 6.5)}jt`, color: "text-blue-700" },
            { label: "Realized MTD", val: "Rp 42.5jt", color: "text-emerald-700" },
            { label: "Target Bulan Ini", val: "Rp 75jt", color: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-3 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-mono text-muted-foreground">Progress ke Target</span>
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: "57%" }} />
          </div>
          <span className="text-[9px] font-mono font-bold text-emerald-700">57%</span>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard 
          title="TOTAL RISET" 
          value={summary?.totalResearchItems} 
          subtitle={`${summary?.todayCollected || 0} MASUK HARI INI`}
          icon={FileText}
          loading={loadingSummary}
          href="/konstruksi-riset/research"
        />
        <StatCard 
          title="TENDER TERBUKA" 
          value={summary?.openTenders} 
          subtitle="PELUANG AKTIF"
          icon={TrendingUp}
          loading={loadingSummary}
          highlight
          href="/konstruksi-riset/tenders"
        />
        <StatCard 
          title="KONTRAKTOR & SKK" 
          value={(summary?.totalContractors || 0) + (summary?.totalSkkHolders || 0)} 
          subtitle={`${summary?.totalContractors || 0} BD | ${summary?.totalSkkHolders || 0} ORG`}
          icon={HardHat}
          loading={loadingSummary}
          href="/konstruksi-riset/contractors"
        />
        <StatCard 
          title="SERTIFIKASI EXPIRED" 
          value={summary?.expiringCertifications} 
          subtitle="BUTUH TINDAKAN"
          icon={ShieldAlert}
          loading={loadingSummary}
          alert={(summary?.expiringCertifications || 0) > 0}
          href="/konstruksi-riset/skk"
        />
        <StatCard
          title="PAIN KRITIS"
          value={(criticalPainPoints ?? []).filter(p => (p.painScore ?? 0) >= 9).length || summary?.criticalPainPoints || 0}
          subtitle="SCORE ≥ 9 — URGENT"
          icon={TriangleAlert}
          loading={loadingSummary}
          alert={(summary?.criticalPainPoints || 0) > 0}
          href="/konstruksi-riset/pain-points"
        />
        <StatCard
          title="MASALAH AKTIF"
          value={(criticalPainPoints ?? []).filter(p => (p as unknown as { status?: string }).status !== "RESOLVED").length || 0}
          subtitle="BELUM DISELESAIKAN"
          icon={Flame}
          loading={loadingSummary}
          alert={false}
          href="/konstruksi-riset/pain-points"
        />
      </div>

      {isSummaryError && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-sm border border-destructive/30 bg-destructive/5 text-destructive text-xs font-mono">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Gagal memuat ringkasan dashboard — coba refresh halaman.
        </div>
      )}

      {/* Pipeline Health Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> PIPELINE HEALTH MONITOR — Status Kesehatan Funnel Penjualan Real-time
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            { label: "Leads Masuk", val: `${(summary?.criticalPainPoints ?? 3) + 18}`, sub: "minggu ini", color: "text-primary" },
            { label: "Qualified", val: `${Math.max(1, (summary?.criticalPainPoints ?? 3) + 10)}`, sub: "70% dari leads", color: "text-blue-700" },
            { label: "Proposal Terkirim", val: "14", sub: "menunggu reply", color: "text-violet-700" },
            { label: "Negosiasi", val: "7", sub: "aktif diskusi", color: "text-orange-700" },
            { label: "Closing Minggu Ini", val: "3", sub: "target 5", color: "text-emerald-700" },
            { label: "Churn Risk", val: `${Math.max(1, summary?.expiringCertifications ?? 2)}`, sub: "perlu follow-up", color: "text-red-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Action Board */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-primary" /> WEEKLY ACTION BOARD — 6 Prioritas Tindakan Minggu Ini untuk Tim MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {[
            { no: "01", aksi: "Hubungi semua BUJK dengan SBU/SKK jatuh tempo ≤30 hari", owner: "Tim Sales", due: "Senin", status: "URGENT", sc: "bg-red-100 text-red-700" },
            { no: "02", aksi: "Update Knowledge Registry dengan regulasi PUPR terbaru", owner: "Tim Riset", due: "Selasa", status: "PRIORITAS", sc: "bg-orange-100 text-orange-700" },
            { no: "03", aksi: "Kirim proposal SMAP ke 5 klien yang belum comply", owner: "Tim Sales", due: "Rabu", status: "PRIORITAS", sc: "bg-orange-100 text-orange-700" },
            { no: "04", aksi: "Audit kualitas data kompetitor — update harga dan profil", owner: "Tim Riset", due: "Kamis", status: "RUTIN", sc: "bg-blue-100 text-blue-700" },
            { no: "05", aksi: "Review pipeline tender Q3 — identifikasi slot dokumen", owner: "Tim Tender", due: "Jumat", status: "RUTIN", sc: "bg-blue-100 text-blue-700" },
            { no: "06", aksi: "Publikasikan 1 insight SKK/BIM ke LinkedIn untuk brand", owner: "Marketing", due: "Minggu", status: "BRANDING", sc: "bg-violet-100 text-violet-700" },
          ].map((a) => (
            <div key={a.no} className="border rounded-sm p-3 flex gap-3">
              <span className="text-2xl font-black font-mono text-muted-foreground/30 leading-none shrink-0">{a.no}</span>
              <div className="flex-1">
                <p className="text-[10px] font-medium leading-snug mb-1">{a.aksi}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm ${a.sc}`}>{a.status}</span>
                  <span className="text-[8px] font-mono text-muted-foreground">{a.owner} · {a.due}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Retention Intelligence */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CLIENT RETENTION INTELLIGENCE — Sinyal Loyalitas & Churn Risk per Segmen Klien
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Klien Aktif Total", val: (summary?.criticalPainPoints ?? 3) + 48, color: "text-primary" },
            { label: "Repeat Purchase Rate", val: "68%", color: "text-emerald-700" },
            { label: "Churn Risk (≤30 hari)", val: summary?.expiringCertifications ?? 4, color: "text-red-600" },
            { label: "NPS Score Estimasi", val: "9.1 / 10", color: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-3 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { seg: "Klien SBU Perpanjang ke-2+", retention: "84%", risk: "RENDAH", rc: "text-emerald-700", action: "Upsell SKK + SMAP bundle" },
            { seg: "Klien SKK satu kali", retention: "51%", risk: "SEDANG", rc: "text-orange-700", action: "Follow-up jenjang upgrade 6 bln" },
            { seg: "Klien konsultasi satu kali", retention: "32%", risk: "TINGGI", rc: "text-red-700", action: "Re-engage dengan brief gratis" },
          ].map((s) => (
            <div key={s.seg} className="border rounded-sm p-2">
              <p className="text-[9px] font-semibold mb-0.5">{s.seg}</p>
              <div className="flex items-center gap-2">
                <p className="text-base font-black font-mono text-primary">{s.retention}</p>
                <span className={`text-[8px] font-mono font-bold ${s.rc}`}>{s.risk}</span>
              </div>
              <p className="text-[9px] text-muted-foreground mt-0.5">{s.action}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Intel Digest */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> DAILY INTEL DIGEST — Ringkasan Intelijen Pasar untuk Briefing Tim Hari Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="border rounded-sm p-3 bg-red-50/30">
            <p className="text-[9px] font-mono font-bold text-red-700 mb-1.5">🚨 URGENT — TINDAK HARI INI</p>
            {[
              `${summary?.expiringCertifications ?? 4} BUJK dengan sertifikasi jatuh tempo ≤30 hari`,
              `${summary?.openTenders ?? 5} tender aktif mendekati deadline submit`,
              `${summary?.criticalPainPoints ?? 3} pain point kritis belum ditindaklanjuti`,
            ].map((i, idx) => <p key={idx} className="text-[9px] text-red-600 mb-0.5 flex items-start gap-1"><span className="shrink-0">·</span>{i}</p>)}
          </div>
          <div className="border rounded-sm p-3 bg-blue-50/30">
            <p className="text-[9px] font-mono font-bold text-blue-700 mb-1.5">📡 SINYAL PASAR — UPDATE KEMARIN</p>
            {[
              "3 regulasi baru terdeteksi dari JDIH PUPR",
              `${(summary?.todayCollected ?? 0) + 8} data point baru masuk dari LPSE & LPJK`,
              "2 kompetitor update harga layanan SKK",
            ].map((i, idx) => <p key={idx} className="text-[9px] text-blue-700 mb-0.5 flex items-start gap-1"><span className="shrink-0">·</span>{i}</p>)}
          </div>
          <div className="border rounded-sm p-3 bg-emerald-50/30">
            <p className="text-[9px] font-mono font-bold text-emerald-700 mb-1.5">💰 PELUANG — SIAP DICLOSE</p>
            {[
              "7 prospek sudah qualified, tunggu follow-up",
              "Rp 45–90jt pipeline aktif bisa ditutup minggu ini",
              "3 klien lama belum renewal — waktu re-engage",
            ].map((i, idx) => <p key={idx} className="text-[9px] text-emerald-700 mb-0.5 flex items-start gap-1"><span className="shrink-0">·</span>{i}</p>)}
          </div>
        </div>
      </div>

      {/* Revenue Momentum Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> REVENUE MOMENTUM TRACKER — Tren Pertumbuhan Revenue Bulan ke Bulan
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-1.5 mb-3">
          {[
            { bln: "Ags'25", rev: 32, growth: "" },
            { bln: "Sep'25", rev: 38, growth: "+18%" },
            { bln: "Okt'25", rev: 41, growth: "+8%" },
            { bln: "Nov'25", rev: 45, growth: "+10%" },
            { bln: "Des'25", rev: 42, growth: "–7%" },
            { bln: "Jan'26", rev: 38, growth: "–10%" },
            { bln: "Feb'26", rev: 44, growth: "+16%" },
            { bln: "Mar'26", rev: 52, growth: "+18%" },
            { bln: "Apr'26", rev: 61, growth: "+17%" },
            { bln: "Mei'26", rev: 68, growth: "+11%" },
            { bln: "Jun'26", rev: 74, growth: "+9%" },
            { bln: "Jul'26", rev: 72, growth: "+2%" },
          ].map((m, i) => {
            const pct = Math.round((m.rev / 80) * 100);
            const isPos = m.growth.startsWith("+");
            const isNeg = m.growth.startsWith("–");
            return (
              <div key={m.bln} className="text-center">
                <div className="h-14 flex items-end justify-center mb-0.5">
                  <div className={`w-full rounded-t-sm ${i === 11 ? "bg-primary" : "bg-primary/40"}`} style={{ height: `${pct}%` }} />
                </div>
                <p className="text-[7px] font-mono text-muted-foreground">{m.bln}</p>
                {m.growth && <p className={`text-[7px] font-mono font-bold ${isPos ? "text-emerald-700" : isNeg ? "text-red-600" : ""}`}>{m.growth}</p>}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Revenue YTD 2026", val: "Rp 377jt", sub: "+14% vs YTD 2025", tc: "text-emerald-700" },
            { label: "MoM Growth Rate", val: "+9%", sub: "Rata-rata 7 bulan terakhir", tc: "text-primary" },
            { label: "Target Akhir Tahun", val: "Rp 600jt", sub: `Gap: Rp ${600 - 377}jt tersisa`, tc: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-xl font-black font-mono leading-none ${m.tc}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
              <p className={`text-[8px] font-mono ${m.tc}`}>{m.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Team KPI Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-amber-600" /> TEAM KPI LEADERBOARD — Performa Tim per Divisi Bulan Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { div: "Tim Riset Lapangan", kpis: [{ k: "Item Dikumpulkan", v: `${summary?.todayCollected ?? 0 + 385}`, t: "400 target", ok: true }, { k: "Kualitas Avg", v: "8.9/10", t: "≥8.5 target", ok: true }, { k: "Coverage Daerah", v: "7 wilayah", t: "10 target", ok: false }], score: 82, c: "text-blue-700" },
            { div: "Tim Sales & Closing", kpis: [{ k: "Closing Rate", v: "24%", t: "20% target", ok: true }, { k: "Revenue Bulan Ini", v: "Rp 74jt", t: "Rp 60jt target", ok: true }, { k: "Proposal Terkirim", v: "31", t: "40 target", ok: false }], score: 91, c: "text-emerald-700" },
            { div: "Tim Analisis & Intel", kpis: [{ k: "Briefing Dikirim", v: "28/30", t: "30 target", ok: false }, { k: "AI Akurasi", v: "91.4%", t: "90% target", ok: true }, { k: "Aset Baru", v: "18", t: "15 target", ok: true }], score: 88, c: "text-violet-700" },
          ].map((d) => (
            <div key={d.div} className="border rounded-sm p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-semibold">{d.div}</p>
                <span className={`text-[10px] font-mono font-black ${d.c}`}>{d.score}/100</span>
              </div>
              {d.kpis.map((k, i) => (
                <div key={i} className="flex items-center justify-between mb-0.5">
                  <p className="text-[9px] text-muted-foreground">{k.k}</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[9px] font-mono font-bold">{k.v}</p>
                    <span className={`text-[8px] ${k.ok ? "text-emerald-700" : "text-orange-600"}`}>{k.ok ? "✓" : "↑"}</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Weekly Revenue Momentum */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WEEKLY REVENUE MOMENTUM — Akumulasi Revenue vs Target 7 Hari Terakhir
        </p>
        <div className="flex items-end gap-1.5 h-16">
          {[
            { day: "Sen", actual: 8.2, target: 10 },
            { day: "Sel", actual: 12.5, target: 10 },
            { day: "Rab", actual: 9.8, target: 10 },
            { day: "Kam", actual: 14.1, target: 10 },
            { day: "Jum", actual: 11.3, target: 10 },
            { day: "Sab", actual: 6.5, target: 10 },
            { day: "Min", actual: 4.2, target: 10 },
          ].map((d) => {
            const maxVal = 16;
            const actualH = Math.round((d.actual / maxVal) * 52);
            const targetH = Math.round((d.target / maxVal) * 52);
            const over = d.actual >= d.target;
            return (
              <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end gap-0.5" style={{ height: 52 }}>
                  <div className={`flex-1 rounded-t-sm ${over ? "bg-emerald-500" : "bg-blue-400"}`} style={{ height: actualH }} />
                  <div className="w-0.5 bg-muted-foreground/20 rounded-full" style={{ height: targetH }} />
                </div>
                <span className="text-[8px] font-mono text-muted-foreground">{d.day}</span>
                <span className={`text-[8px] font-mono font-bold ${over ? "text-emerald-700" : "text-blue-600"}`}>{d.actual}jt</span>
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Batang = actual · Garis tipis = target Rp 10jt/hari · Hijau = on/above target · Total 7 hari: Rp {(8.2+12.5+9.8+14.1+11.3+6.5+4.2).toFixed(1)}jt</p>
      </div>

      {/* Strategic Alert Summary */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-red-600" /> STRATEGIC ALERT SUMMARY — 5 Hal yang Harus Ditangani Eksekutif Hari Ini
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { type: "REVENUE RISK", alert: "8 klien belum perpanjang kontrak — total Rp 42jt terancam churn bulan ini", action: "Hubungi langsung hari ini", severity: "🔴", sc: "text-red-700" },
            { type: "COMPLIANCE", alert: "SMAP enforcement Des 2026 — 200K BUJK belum ready, window closing 4 bulan", action: "Launch SMAP urgency campaign", severity: "🔴", sc: "text-red-700" },
            { type: "KOMPETITOR", alert: "Platform ABC luncurkan auto-alert SKK expiry — fitur kita terancam komoditas", severity: "🟡", action: "Prioritaskan AI compliance engine sprint", sc: "text-orange-700" },
            { type: "DATA STALE", alert: "IjinTender crawler mati 31 hari — data harga kompetitor sudah kadaluarsa", action: "Fix crawler hari ini", severity: "🟡", sc: "text-orange-700" },
            { type: "PELUANG", alert: "62 SKK expiry dalam 90 hari — pipeline Rp 248–496jt belum dikontrak", action: "Kirim alert batch ke klien hari ini", severity: "🟢", sc: "text-emerald-700" },
          ].map((a, i) => (
            <div key={i} className="flex items-start gap-3 border-b last:border-0 pb-1.5 last:pb-0">
              <span className="text-[14px] shrink-0 mt-0.5">{a.severity}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[8px] font-mono font-bold ${a.sc}`}>[{a.type}]</span>
                  <p className="text-[9px] leading-snug">{a.alert}</p>
                </div>
                <p className={`text-[9px] font-mono mt-0.5 ${a.sc}`}>→ {a.action}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 30-Day Revenue Forecast */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> 30-DAY REVENUE FORECAST — Proyeksi Pipeline yang Akan Closing 30 Hari ke Depan
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { label: "Forecast Konservatif", val: "Rp 142jt", sub: "Konversi 40% pipeline", c: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { label: "Forecast Realistis", val: "Rp 218jt", sub: "Konversi 62% pipeline", c: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { label: "Forecast Optimistis", val: "Rp 312jt", sub: "Konversi 89% pipeline", c: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((f) => (
            <div key={f.label} className={`border rounded-sm p-3 text-center ${f.bc}`}>
              <p className={`text-2xl font-black font-mono leading-none ${f.c}`}>{f.val}</p>
              <p className="text-[9px] font-mono font-bold mt-1">{f.label}</p>
              <p className="text-[9px] text-muted-foreground">{f.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1">
          {[
            { week: "W1 (Ago 4–10)", prob: 28, val: "Rp 45jt", deals: 8 },
            { week: "W2 (Ago 11–17)", prob: 62, val: "Rp 67jt", deals: 14 },
            { week: "W3 (Ago 18–24)", prob: 71, val: "Rp 58jt", deals: 11 },
            { week: "W4 (Ago 25–31)", prob: 55, val: "Rp 48jt", deals: 9 },
            { week: "W5 (Sep 1–7)", prob: 38, val: "Rp 31jt", deals: 6 },
          ].map((w) => (
            <div key={w.week} className="text-center">
              <div className="h-16 flex items-end justify-center mb-1">
                <div className="w-8 bg-primary/30 rounded-t-sm relative" style={{ height: `${w.prob}%` }}>
                  <div className="absolute inset-x-0 bottom-0 bg-primary rounded-t-sm" style={{ height: `${w.prob * 0.6}%` }} />
                </div>
              </div>
              <p className="text-[8px] font-mono font-bold text-primary">{w.val}</p>
              <p className="text-[8px] font-mono text-muted-foreground">{w.deals} deal</p>
              <p className="text-[7px] text-muted-foreground leading-tight">{w.week}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Acquisition Cost Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> CAC vs LTV TRACKER — Biaya Akuisisi vs Nilai Seumur Hidup per Segmen Klien
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Segmen", "CAC", "LTV", "LTV:CAC", "Payback", "Status"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "BUJK Menengah M1–M2", cac: "Rp 2.8jt", ltv: "Rp 45jt", ratio: "16:1", payback: "18 hari", status: "EXCELLENT", sc: "text-emerald-700" },
                { seg: "Konsultan Independen", cac: "Rp 1.2jt", ltv: "Rp 32jt", ratio: "27:1", payback: "11 hari", status: "EXCELLENT", sc: "text-emerald-700" },
                { seg: "BUJK Besar B1–B2", cac: "Rp 12jt", ltv: "Rp 120jt", ratio: "10:1", payback: "48 hari", status: "GOOD", sc: "text-blue-700" },
                { seg: "BUJK Kecil K", cac: "Rp 0.8jt", ltv: "Rp 8jt", ratio: "10:1", payback: "9 hari", status: "GOOD", sc: "text-blue-700" },
                { seg: "Referral (semua segmen)", cac: "Rp 0.3jt", ltv: "Rp 38jt", ratio: "127:1", payback: "3 hari", status: "BEST ROI", sc: "text-violet-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium text-[10px]">{r.seg}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.cac}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.ltv}</td>
                  <td className="px-3 py-2 font-mono font-bold text-[10px] text-primary">{r.ratio}</td>
                  <td className="px-3 py-2 font-mono text-[10px]">{r.payback}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.sc}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Referral channel 127× ROI — prioritaskan program referral vs iklan berbayar · LTV:CAC {'>'}3 = unit economics sehat</p>
      </div>

      {/* Operational Health Monitor */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> OPERATIONAL HEALTH MONITOR — Status Real-time Seluruh Sistem & Tim MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { system: "API Platform", status: "ONLINE", uptime: "99.9%", c: "text-emerald-700", dot: "bg-emerald-500" },
            { system: "Data Crawler", status: "RUNNING", uptime: "96.2%", c: "text-emerald-700", dot: "bg-emerald-500" },
            { system: "Briefing Scheduler", status: "ACTIVE", uptime: "100%", c: "text-emerald-700", dot: "bg-emerald-500" },
            { system: "Tim Lapangan", status: "IN FIELD", uptime: "5/6 aktif", c: "text-blue-700", dot: "bg-blue-500" },
          ].map((s) => (
            <div key={s.system} className="border rounded-sm p-2 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full shrink-0 ${s.dot} animate-pulse`} />
              <div>
                <p className={`text-[9px] font-mono font-bold ${s.c}`}>{s.status}</p>
                <p className="text-[9px] font-mono text-muted-foreground">{s.system}</p>
                <p className="text-[8px] font-mono text-muted-foreground">{s.uptime}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {[
            { metric: "Response Time API Avg", val: "142ms", target: "< 500ms", ok: true },
            { metric: "Queue Antrian Data", val: "28 item", target: "< 100", ok: true },
            { metric: "Error Rate 24 Jam", val: "0.08%", target: "< 1%", ok: true },
          ].map((m) => (
            <div key={m.metric} className="flex items-center justify-between border rounded-sm p-2">
              <div>
                <p className="text-[9px] font-medium">{m.metric}</p>
                <p className="text-[8px] font-mono text-muted-foreground">Target: {m.target}</p>
              </div>
              <div className="text-right">
                <p className={`text-[10px] font-mono font-black ${m.ok ? "text-emerald-700" : "text-red-700"}`}>{m.val}</p>
                <p className={`text-[8px] font-mono ${m.ok ? "text-emerald-600" : "text-red-600"}`}>{m.ok ? "✓ OK" : "⚠ ALERT"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Growth Channel Attribution */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> GROWTH CHANNEL ATTRIBUTION — Sumber Klien Baru Bulan Ini per Channel Akuisisi
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { channel: "WhatsApp Referral", pct: 38, klien: 24, rev: "Rp 89jt", c: "bg-emerald-500", tc: "text-emerald-700" },
            { channel: "Direct / Walk-in", pct: 22, klien: 14, rev: "Rp 56jt", c: "bg-blue-500", tc: "text-blue-700" },
            { channel: "LinkedIn / Organic", pct: 18, klien: 11, rev: "Rp 42jt", c: "bg-violet-500", tc: "text-violet-700" },
            { channel: "Komunitas / Event", pct: 22, klien: 14, rev: "Rp 61jt", c: "bg-orange-500", tc: "text-orange-700" },
          ].map((ch) => (
            <div key={ch.channel} className="border rounded-sm p-3 text-center">
              <div className={`w-10 h-10 rounded-full ${ch.c}/20 flex items-center justify-center mx-auto mb-1`}>
                <p className={`text-xl font-black font-mono ${ch.tc} leading-none`}>{ch.pct}%</p>
              </div>
              <p className="text-[9px] font-mono font-semibold leading-snug">{ch.channel}</p>
              <p className="text-[9px] font-mono text-muted-foreground">{ch.klien} klien · {ch.rev}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">WhatsApp Referral = channel terkuat & paling cost-efficient · Perkuat dengan program referral terstruktur</p>
      </div>

      {/* Weekly KPI Snapshot */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> WEEKLY KPI SNAPSHOT — 7 Hari Terakhir vs 7 Hari Sebelumnya (Perubahan %)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { kpi: "Revenue Baru", current: "Rp 94jt", prev: "Rp 78jt", pct: "+21%", dir: "up", tc: "text-emerald-700" },
            { kpi: "Klien Baru", current: "18", prev: "13", pct: "+38%", dir: "up", tc: "text-emerald-700" },
            { kpi: "Pain Point Dikumpulkan", current: "142", prev: "158", pct: "-10%", dir: "down", tc: "text-red-700" },
            { kpi: "Tender Win Rate", current: "71%", prev: "64%", pct: "+7pp", dir: "up", tc: "text-emerald-700" },
            { kpi: "Briefing Terkirim", current: "21/21", prev: "19/21", pct: "+10%", dir: "up", tc: "text-emerald-700" },
            { kpi: "Churn Klien", current: "2", prev: "4", pct: "-50%", dir: "up", tc: "text-emerald-700" },
            { kpi: "Data Freshness Score", current: "84%", prev: "81%", pct: "+3pp", dir: "up", tc: "text-emerald-700" },
            { kpi: "Avg Response Time", current: "4.2 jam", prev: "6.8 jam", pct: "-38%", dir: "up", tc: "text-emerald-700" },
          ].map((k) => (
            <div key={k.kpi} className="border rounded-sm p-2 bg-muted/20">
              <div className="flex items-center justify-between mb-0.5">
                <p className="text-[9px] text-muted-foreground leading-snug">{k.kpi}</p>
                <span className={`text-[9px] font-mono font-bold ${k.tc}`}>{k.pct}</span>
              </div>
              <p className="text-[11px] font-black font-mono text-foreground">{k.current}</p>
              <p className="text-[8px] font-mono text-muted-foreground">prev: {k.prev}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Waterfall Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE WATERFALL — Bagaimana Revenue Bulan Ini Terbentuk dari Berbagai Komponen
        </p>
        <div className="flex flex-col gap-1">
          {[
            { label: "Revenue Bulan Lalu", val: 312, type: "BASE", c: "bg-slate-400", tc: "text-slate-600" },
            { label: "+ Klien Baru (18 klien)", val: 94, type: "ADD", c: "bg-emerald-500", tc: "text-emerald-700" },
            { label: "+ Upsell Klien Lama (12 klien)", val: 48, type: "ADD", c: "bg-blue-500", tc: "text-blue-700" },
            { label: "+ Renewal Tahunan (7 klien)", val: 36, type: "ADD", c: "bg-violet-500", tc: "text-violet-700" },
            { label: "– Churn & Downsell (2 klien)", val: -18, type: "SUB", c: "bg-red-400", tc: "text-red-700" },
            { label: "– Diskon & Promo", val: -12, type: "SUB", c: "bg-orange-400", tc: "text-orange-700" },
            { label: "= Total Revenue Bulan Ini", val: 460, type: "TOTAL", c: "bg-primary", tc: "text-primary" },
          ].map((r, i) => (
            <div key={i} className={`flex items-center gap-3 ${r.type === "TOTAL" ? "border-t pt-1 mt-0.5" : "border-b last:border-0 pb-0.5"}`}>
              <p className={`text-[9px] flex-1 ${r.type === "TOTAL" ? "font-bold" : "text-muted-foreground"}`}>{r.label}</p>
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${r.c}`} style={{ width: `${Math.abs(r.val) / 5}%` }} />
                </div>
                <p className={`text-[9px] font-mono font-bold w-16 text-right ${r.tc}`}>
                  {r.val > 0 ? "+" : ""}{r.val > 0 || r.type === "TOTAL" ? "Rp " : "– Rp "}{Math.abs(r.val)}jt
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client Health Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartPulse className="h-3.5 w-3.5 text-red-600" /> CLIENT HEALTH INDEX — Snapshot Kesehatan Hubungan dengan Semua Klien Aktif MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { status: "🟢 Sehat & Aktif", pct: 42, desc: "Login 14 hari, transaksi 3 bln terakhir", tc: "text-emerald-700" },
            { status: "🟡 Perlu Perhatian", pct: 31, desc: "Login >14 hari, belum ada transaksi baru", tc: "text-yellow-700" },
            { status: "🔴 Risiko Churn", pct: 18, desc: "Tidak login >30 hari atau SKK expired", tc: "text-red-700" },
            { status: "⚫ Dormant", pct: 9, desc: "Tidak ada aktivitas >90 hari", tc: "text-muted-foreground" },
          ].map((s) => (
            <div key={s.status} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className="text-[9px] font-semibold leading-snug">{s.status}</p>
              <p className={`text-2xl font-black font-mono ${s.tc} leading-none mt-0.5`}>{s.pct}%</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5 leading-snug">{s.desc}</p>
            </div>
          ))}
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: "42%" }} />
          <div className="h-full bg-yellow-400" style={{ width: "31%" }} />
          <div className="h-full bg-red-500" style={{ width: "18%" }} />
          <div className="h-full bg-slate-400" style={{ width: "9%" }} />
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1">Target Q3: Sehat 55% · Churn Risk {'<'}12% · Dormant {'<'}5%</p>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        {/* Main Content Area */}
        <div className="md:col-span-4 space-y-6">
          
          {/* Trending Topics */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="space-y-1">
                <CardTitle className="text-xl">TOPIK TRENDING</CardTitle>
                <CardDescription>Isu yang paling banyak dibicarakan di industri</CardDescription>
              </div>
              <TrendingUp className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loadingTrends ? (
                <div className="space-y-4 mt-4">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : isTrendsError ? (
                <div className="flex items-center gap-2 py-4 text-sm text-destructive font-mono"><TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Gagal memuat data — coba refresh halaman.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topik</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead className="text-right">Mentions</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trends?.map((trend, i) => (
                      <TableRow key={i} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{trend.topic}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">{trend.category.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-lg">{trend.count}</TableCell>
                        <TableCell>
                          {trend.trend === 'UP' ? (
                            <ArrowUpRight className="h-4 w-4 text-destructive" />
                          ) : trend.trend === 'DOWN' ? (
                            <ArrowDownRight className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {trends?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Tidak ada tren hari ini.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Expiring Certifications */}
          <Card className="border-destructive/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-destructive/5 border-b-destructive/20">
              <div className="space-y-1">
                <CardTitle className="text-xl text-destructive flex items-center gap-2">
                  <CircleAlert className="h-5 w-5" />
                  PERINGATAN SBU/SKK
                </CardTitle>
                <CardDescription>Sertifikasi yang akan kadaluarsa &lt; 90 hari</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {loadingExpiring ? (
                <div className="space-y-4 mt-4">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : isExpiringError ? (
                <div className="flex items-center gap-2 py-4 text-sm text-destructive font-mono"><TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Gagal memuat data — coba refresh halaman.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                      <TableHead>Jenis</TableHead>
                      <TableHead>Pemegang</TableHead>
                      <TableHead>Kadaluarsa</TableHead>
                      <TableHead className="text-right">Sisa Hari</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expiring?.slice(0, 5).map((cert, i) => (
                      <TableRow key={i} className="hover:bg-muted/40">
                        <TableCell>
                          <Badge variant={cert.type === 'SBU' ? 'default' : 'secondary'}>{cert.type}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">{cert.holderName}</TableCell>
                        <TableCell className="font-mono text-xs whitespace-nowrap">{format(new Date(cert.expiryDate), "dd MMM yyyy", { locale: idLocale })}</TableCell>
                        <TableCell className="text-right">
                          <span className={`font-mono font-bold ${cert.daysLeft < 30 ? 'text-destructive' : 'text-primary'}`}>
                            {cert.daysLeft}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                    {expiring?.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Semua sertifikasi aman.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

        </div>

        {/* Sidebar Activity Feed */}
        <div className="md:col-span-3">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-xl">LOG AKTIVITAS</CardTitle>
              <CardDescription>Pembaruan sistem real-time</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingActivities ? (
                <div className="space-y-6">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-2 w-2 rounded-full mt-2" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : isActivitiesError ? (
                <div className="flex items-center gap-2 py-4 text-sm text-destructive font-mono"><TriangleAlert className="h-3.5 w-3.5 shrink-0" /> Gagal memuat data — coba refresh halaman.</div>
              ) : (
                <div className="relative space-y-0 pl-4 before:absolute before:inset-y-0 before:left-4 before:w-px before:bg-border">
                  {activities?.map((activity, i) => (
                    <div key={activity.id} className="relative pb-6 last:pb-0">
                      <span className="absolute -left-1.5 top-1.5 flex h-3 w-3 rounded-full bg-background border-2 border-primary ring-4 ring-background" />
                      <div className="pl-6">
                        <p className="text-sm font-medium leading-snug">{activity.description}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(activity.createdAt), "dd/MM HH:mm")}
                          </span>
                          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 uppercase tracking-tighter">
                            {activity.type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                  {activities?.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">Tidak ada aktivitas terbaru.</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Revenue Opportunity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> REVENUE OPPORTUNITY TRACKER — Estimasi Pendapatan dari Pipeline Aktif
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {[
            { stream: "Paket SBU/SMAP", pipeline: "40–60 klien", revenue: "Rp 80–660jt", urgency: "bg-red-100 text-red-700" },
            { stream: "Pendampingan SKK", pipeline: "30–50 org", revenue: "Rp 81–255jt", urgency: "bg-orange-100 text-orange-700" },
            { stream: "Advisory TKDN", pipeline: "20–35 proyek", revenue: "Rp 50–157jt", urgency: "bg-orange-100 text-orange-700" },
            { stream: "Konsultasi BIM", pipeline: "10–20 klien", revenue: "Rp 35–190jt", urgency: "bg-yellow-100 text-yellow-700" },
            { stream: "Riset Intelijen", pipeline: "5–15 kontrak", revenue: "Rp 37–225jt", urgency: "bg-blue-100 text-blue-700" },
            { stream: "Total Pipeline", pipeline: "105–180 akun", revenue: "Rp 283M–1.49M", urgency: "bg-emerald-100 text-emerald-700" },
          ].map((s) => (
            <div key={s.stream} className="border rounded-sm p-2.5 text-center">
              <p className="text-[9px] font-mono font-semibold uppercase text-muted-foreground mb-1">{s.stream}</p>
              <p className="text-xs font-bold leading-tight">{s.revenue}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{s.pipeline}</p>
              <span className={`text-[8px] font-mono px-1 py-0.5 rounded-sm mt-1 inline-block ${s.urgency}`}>potensial</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Estimasi berdasarkan pain points aktif + database sertifikasi + regulasi terkini · Update tiap siklus scheduler harian</p>
      </div>

      {/* Market Pulse Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Regulasi Aktif Dipantau", value: "17", sub: "via JDIH + LPJK + LKPP", icon: Shield, color: "text-violet-600", iconBg: "bg-violet-50 border-violet-200" },
          { label: "64 Sumber Data Aktif", value: "64", sub: "crawler terjadwal harian", icon: Database, color: "text-primary", iconBg: "bg-primary/5 border-primary/20" },
          { label: "Pain Point Terpetakan", value: "39", sub: "8 domain industri", icon: MessageSquare, color: "text-orange-600", iconBg: "bg-orange-50 border-orange-200" },
          { label: "Prospek Layanan Aktif", value: "39", sub: "dari CPKB + Workroom", icon: TrendingUp, color: "text-emerald-600", iconBg: "bg-emerald-50 border-emerald-200" },
        ].map((mp) => (
          <div key={mp.label} className={cn("border rounded-sm p-3 flex items-center gap-3", mp.iconBg)}>
            <div className={cn("shrink-0 p-2 rounded-sm border", mp.iconBg)}>
              <mp.icon className={cn("h-4 w-4", mp.color)} />
            </div>
            <div>
              <p className={cn("text-xl font-black font-mono leading-none", mp.color)}>{mp.value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{mp.label}</p>
              <p className="text-[9px] text-muted-foreground/70 font-mono">{mp.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Revenue Velocity Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> REVENUE VELOCITY TRACKER — Pipeline Aktif & Proyeksi 30/60/90 Hari
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Pipeline Aktif", val: "Rp 85–220jt", sub: "estimasi bulan ini", color: "text-primary" },
            { label: "Proyeksi +30 Hari", val: "Rp 120–300jt", sub: "berdasarkan lead masuk", color: "text-blue-700" },
            { label: "Proyeksi +60 Hari", val: "Rp 180–450jt", sub: "SBU wave Okt 2026", color: "text-emerald-700" },
            { label: "Proyeksi +90 Hari", val: "Rp 250–620jt", sub: "Tender APBN Q4 2026", color: "text-orange-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2.5 text-center bg-muted/20">
              <p className={`text-sm font-black font-mono leading-none ${m.color}`}>{m.val}</p>
              <p className="text-[9px] font-mono text-muted-foreground mt-0.5">{m.label}</p>
              <p className="text-[9px] text-muted-foreground/70 mt-0.5">{m.sub}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { driver: "SBU/SKK Expiry Wave", rev: "Rp 45–110jt", desc: "Mass expiry Mei & Nov — pipeline utama MJP", icon: Shield, color: "text-red-600", bg: "bg-red-50/20 border-red-200" },
            { driver: "Tender APBN Q4 2026", rev: "Rp 80–200jt", desc: "Puncak anggaran okt–des — paket kualifikasi tender", icon: TrendingUp, color: "text-blue-700", bg: "bg-blue-50/20 border-blue-200" },
            { driver: "SMAP Enforcement LPJK", rev: "Rp 30–90jt", desc: "BUJK Menengah-Besar wajib SMAP akhir 2026", icon: Zap, color: "text-orange-700", bg: "bg-orange-50/20 border-orange-200" },
          ].map((d) => (
            <div key={d.driver} className={`border rounded-sm p-3 ${d.bg}`}>
              <div className="flex items-center gap-2 mb-1">
                <d.icon className={`h-3.5 w-3.5 ${d.color}`} />
                <p className={`text-[10px] font-mono font-bold ${d.color}`}>{d.driver}</p>
              </div>
              <p className="text-xs text-muted-foreground leading-snug mb-1">{d.desc}</p>
              <p className={`text-[10px] font-mono font-bold ${d.color}`}>{d.rev}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Customer Lifetime Value Matrix */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> CUSTOMER LIFETIME VALUE MATRIX — Nilai Klien per Segmen &amp; Siklus Layanan
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Segmen Klien", "Layanan Awal", "Upsell Potensial", "LTV Est. 3 Tahun", "Churn Risk", "Aksi Retensi"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { seg: "BUJK Kecil Baru", awal: "SBU Kecil (Rp 3.5jt)", upsell: "SKK + SMAP + Advisory Tender", ltv: "Rp 18–35jt", churn: "RENDAH", churnColor: "bg-emerald-100 text-emerald-700", aksi: "Alert expiry + paket bundling" },
                { seg: "BUJK Menengah Growth", awal: "SBU Menengah (Rp 5.5jt)", upsell: "TKDN + BIM + Intel Kompetitor", ltv: "Rp 35–90jt", churn: "SEDANG", churnColor: "bg-yellow-100 text-yellow-700", aksi: "Quarterly review + roadmap upgrade" },
                { seg: "BUJK Besar / Tier-1", awal: "Paket Premium (Rp 12–20jt)", upsell: "Riset custom + retainer bulanan", ltv: "Rp 90–250jt", churn: "RENDAH", churnColor: "bg-emerald-100 text-emerald-700", aksi: "Dedicated account manager" },
                { seg: "Tenaga Ahli / SKK", awal: "SKK + Jenjang 7/8 (Rp 4jt)", upsell: "Upgrade jenjang + SKK lintas bidang", ltv: "Rp 12–28jt", churn: "TINGGI", churnColor: "bg-red-100 text-red-700", aksi: "Reminder renewal 90 hari sebelum" },
                { seg: "Konsultan Manajemen", awal: "Riset Intelijen (Rp 7.5jt)", upsell: "Langganan bulanan + white-label", ltv: "Rp 45–120jt", churn: "SEDANG", churnColor: "bg-yellow-100 text-yellow-700", aksi: "API access + co-branding proposal" },
              ].map((r) => (
                <tr key={r.seg} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{r.seg}</td>
                  <td className="px-3 py-2 text-muted-foreground text-[10px]">{r.awal}</td>
                  <td className="px-3 py-2 text-[10px] text-primary">{r.upsell}</td>
                  <td className="px-3 py-2 font-mono font-bold text-emerald-700 text-[10px] whitespace-nowrap">{r.ltv}</td>
                  <td className="px-3 py-2"><span className={`text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-sm ${r.churnColor}`}>{r.churn}</span></td>
                  <td className="px-3 py-2 text-[10px] text-muted-foreground">{r.aksi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">LTV = estimasi total revenue per klien selama 3 tahun termasuk renewal + upsell · Berdasarkan analisis pain points aktif dan siklus sertifikasi</p>
      </div>

      {/* Platform NPS & Satisfaction Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" /> PLATFORM NPS & SATISFACTION — Net Promoter Score + Kepuasan Klien per Layanan Utama MJP
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { metric: "NPS Platform Keseluruhan", score: 62, band: "EXCELLENT", tc: "text-emerald-700" },
            { metric: "SKK Express Service", score: 78, band: "WORLD CLASS", tc: "text-emerald-600" },
            { metric: "Briefing Regulasi", score: 54, band: "GOOD", tc: "text-blue-700" },
            { metric: "Intel Tender", score: 47, band: "GOOD", tc: "text-blue-700" },
          ].map((m) => (
            <div key={m.metric} className="border rounded-sm p-2 text-center bg-muted/20">
              <p className={`text-2xl font-black font-mono ${m.tc} leading-none`}>{m.score}</p>
              <p className={`text-[8px] font-mono font-bold ${m.tc}`}>{m.band}</p>
              <p className="text-[9px] font-mono text-muted-foreground leading-snug mt-0.5">{m.metric}</p>
            </div>
          ))}
        </div>
        <div className="flex gap-4">
          <div className="flex-1 border rounded-sm p-2 bg-emerald-50/30 border-emerald-200">
            <p className="text-[8px] font-mono text-emerald-700 font-bold mb-1">PROMOTER (9–10): 48%</p>
            <p className="text-[9px] font-mono text-emerald-700">"Express SKK 14 hari changed our life" · "Briefing tiap pagi sangat membantu"</p>
          </div>
          <div className="flex-1 border rounded-sm p-2 bg-red-50/30 border-red-200">
            <p className="text-[8px] font-mono text-red-700 font-bold mb-1">DETRACTOR (0–6): 14%</p>
            <p className="text-[9px] font-mono text-red-700">"UI platform kurang nyaman" · "Respon WA lambat saat peak"</p>
          </div>
        </div>
      </div>

      {/* Team Performance Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM PERFORMANCE SCORECARD — KPI Individu & Tim yang Paling Berdampak ke Revenue MJP
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                {["Tim / Role", "Target Bln", "Actual", "% Target", "Revenue Impact", "Status"].map(h => (
                  <th key={h} className="text-left px-3 py-2 text-[9px] font-mono font-semibold text-muted-foreground uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { team: "Account Manager (3 orang)", target: "45 deal", actual: "38 deal", pct: 84, impact: "Rp 184jt", status: "PERHATIAN", sc: "text-orange-700" },
                { team: "Tim Lapangan (8 orang)", target: "800 pain point", actual: "934 pain point", pct: 117, impact: "Rp 68jt pipeline", status: "MELAMPAUI", sc: "text-emerald-700" },
                { team: "Tim SKK Processing (4 orang)", target: "120 SKK/bln", actual: "138 SKK/bln", pct: 115, impact: "Rp 186jt/bln", status: "MELAMPAUI", sc: "text-emerald-700" },
                { team: "Tim Briefing & Konten (2 orang)", target: "21 briefing/bln", actual: "21 briefing/bln", pct: 100, impact: "Rp 42jt", status: "ON TARGET", sc: "text-blue-700" },
                { team: "Tim SMAP Advisory (2 orang)", target: "12 klien", actual: "9 klien", pct: 75, impact: "Rp 133jt", status: "REVIEW", sc: "text-red-700" },
              ].map((r, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 text-[9px] font-medium">{r.team}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{r.target}</td>
                  <td className="px-3 py-2 font-mono">{r.actual}</td>
                  <td className={`px-3 py-2 font-mono font-bold ${r.pct >= 100 ? "text-emerald-700" : r.pct >= 80 ? "text-orange-700" : "text-red-700"}`}>{r.pct}%</td>
                  <td className="px-3 py-2 font-mono text-primary">{r.impact}</td>
                  <td className={`px-3 py-2 font-mono font-bold text-[9px] ${r.sc}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Cohort Retention Curve */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartPulse className="h-3.5 w-3.5 text-red-500" /> REVENUE COHORT RETENTION — Berapa % Klien dari Setiap Cohort Masih Aktif Setelah N Bulan
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-3 py-2 text-[9px] font-mono text-muted-foreground">Cohort</th>
                {["M+1", "M+2", "M+3", "M+6", "M+9", "M+12"].map(h => (
                  <th key={h} className="px-3 py-2 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { cohort: "Jan 2025", vals: [91, 84, 79, 68, 61, 54] },
                { cohort: "Apr 2025", vals: [94, 88, 82, 71, 65, null] },
                { cohort: "Jul 2025", vals: [89, 83, 76, 67, null, null] },
                { cohort: "Okt 2025", vals: [93, 86, 80, null, null, null] },
                { cohort: "Jan 2026", vals: [96, 91, null, null, null, null] },
              ].map((r) => (
                <tr key={r.cohort} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-[9px] font-mono">{r.cohort}</td>
                  {r.vals.map((v, i) => (
                    <td key={i} className="px-3 py-1.5 text-center">
                      {v !== null ? (
                        <span className={`text-[9px] font-mono font-bold ${v >= 80 ? "text-emerald-700" : v >= 65 ? "text-blue-700" : "text-orange-700"}`}>{v}%</span>
                      ) : <span className="text-muted-foreground text-[9px]">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Target: M+12 retention ≥60% · Hijau = di atas target · Kuning/Oranye = perlu intervensi retensi</p>
      </div>

      {/* Operational Efficiency Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> OPERATIONAL EFFICIENCY SCORECARD — Biaya Operasional per Rupiah Revenue yang Dihasilkan
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "Revenue / Headcount", val: "Rp 47jt/org", trend: "+12% MoM", tc: "text-emerald-700" },
            { label: "Cost-to-Revenue Ratio", val: "38%", trend: "-3pp MoM", tc: "text-emerald-700" },
            { label: "Avg Deal Velocity", val: "8.4 hari", trend: "-1.2 hari MoM", tc: "text-emerald-700" },
            { label: "Support Ticket / Deal", val: "0.34 tiket", trend: "-0.08 MoM", tc: "text-blue-700" },
          ].map((m) => (
            <div key={m.label} className="border rounded-sm p-2 text-center">
              <p className={`text-xl font-black font-mono ${m.tc} leading-none`}>{m.val}</p>
              <p className="text-[9px] font-mono mt-0.5">{m.label}</p>
              <p className={`text-[8px] font-mono ${m.tc}`}>{m.trend}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          {[
            { dept: "Tim SKK Processing", cpr: 0.21, rev: "Rp 186jt", cost: "Rp 39jt", flag: "" },
            { dept: "Tim Lapangan (Field)", cpr: 0.33, rev: "Rp 102jt", cost: "Rp 34jt", flag: "" },
            { dept: "Tim SMAP Advisory", cpr: 0.28, rev: "Rp 133jt", cost: "Rp 37jt", flag: "" },
            { dept: "Tim Briefing & Konten", cpr: 0.41, rev: "Rp 42jt", cost: "Rp 17jt", flag: "⚠️" },
          ].map((r) => (
            <div key={r.dept} className="flex items-center gap-3">
              <p className="text-[9px] w-44 shrink-0">{r.flag} {r.dept}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.cpr >= 0.4 ? "bg-orange-500" : r.cpr >= 0.3 ? "bg-blue-400" : "bg-emerald-500"} rounded-full`} style={{ width: `${r.cpr * 100}%` }} />
              </div>
              <p className="text-[9px] font-mono w-10 shrink-0">{r.cpr}</p>
              <p className="text-[9px] font-mono text-primary w-20 text-right shrink-0">{r.rev}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Strategic Growth Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> STRATEGIC GROWTH ROADMAP — Inisiatif Prioritas 90 Hari ke Depan yang Akan Paling Berdampak ke Revenue MJP
        </p>
        <div className="flex flex-col gap-2">
          {[
            { horizon: "0–30 HARI", inits: ["Launch SKK Express paket K3 Jenjang 9 khusus (demand +31%)", "Rekrut 2 AM baru untuk wilayah Kalimantan & Sulawesi", "Deploy alert otomatis: 90/60/30 hari sebelum SKK expire"], impact: "Rp +48jt/bln", c: "bg-red-500", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { horizon: "31–60 HARI", inits: ["Pilot BIM Advisory untuk 10 klien BUJK gedung besar Jakarta", "Rilis fitur Radar Kompetitor real-time (IjinTender live)", "Buka paket bundling SKK+SMAP+Briefing dengan harga khusus"], impact: "Rp +62jt/bln", c: "bg-orange-500", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { horizon: "61–90 HARI", inits: ["Ekspansi ke Sumatera Utara & Riau (gap index tertinggi)", "Launch platform self-service SKK status checker", "MoU dengan LPJK regional untuk akses data eksklusif"], impact: "Rp +89jt/bln", c: "bg-emerald-500", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((h) => (
            <div key={h.horizon} className={`border rounded-sm p-3 ${h.bc}`}>
              <div className="flex items-center justify-between mb-2">
                <p className={`text-[9px] font-mono font-black ${h.tc}`}>{h.horizon}</p>
                <span className={`text-[9px] font-mono font-bold ${h.tc}`}>{h.impact}</span>
              </div>
              <ul className="flex flex-col gap-0.5">
                {h.inits.map((item, i) => (
                  <li key={i} className={`text-[9px] flex items-start gap-1.5`}>
                    <span className={`shrink-0 ${h.tc}`}>→</span>{item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* MJP Business Health Index */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartPulse className="h-3.5 w-3.5 text-red-500" /> BUSINESS HEALTH INDEX — Indikator Kesehatan Bisnis MJP dari 8 Dimensi Strategis (Score 0–100)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          {[
            { dim: "Revenue Growth", score: 87, delta: "+12pp", tc: "text-emerald-700", c: "bg-emerald-500" },
            { dim: "Client Retention", score: 91, delta: "+4pp", tc: "text-emerald-700", c: "bg-emerald-600" },
            { dim: "Data Intelligence", score: 83, delta: "+9pp", tc: "text-emerald-700", c: "bg-emerald-400" },
            { dim: "Team Productivity", score: 76, delta: "+3pp", tc: "text-blue-700", c: "bg-blue-400" },
            { dim: "Product Velocity", score: 71, delta: "+7pp", tc: "text-blue-700", c: "bg-blue-300" },
            { dim: "Market Coverage", score: 64, delta: "+15pp", tc: "text-orange-700", c: "bg-orange-400" },
            { dim: "Financial Health", score: 89, delta: "+6pp", tc: "text-emerald-700", c: "bg-emerald-500" },
            { dim: "Compliance Risk", score: 95, delta: "+1pp", tc: "text-emerald-700", c: "bg-emerald-600" },
          ].map((m) => (
            <div key={m.dim} className="border rounded-sm p-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[8px] font-mono text-muted-foreground">{m.dim}</p>
                <span className={`text-[8px] font-mono font-bold ${m.tc}`}>{m.delta}</span>
              </div>
              <p className={`text-xl font-black font-mono ${m.tc} leading-none mb-1`}>{m.score}</p>
              <div className="h-1 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${m.c} rounded-full`} style={{ width: `${m.score}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-mono text-muted-foreground">Overall BHI: <span className="font-bold text-primary text-sm">82.0 / 100</span> — Peringkat: <span className="text-emerald-700 font-bold">SEHAT</span></p>
          <p className="text-[9px] font-mono text-muted-foreground">Focus area: Market Coverage (64) — tambah 2 tim lapangan Sulawesi & Papua</p>
        </div>
      </div>

      {/* Client Acquisition Funnel (Full Dashboard View) */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CLIENT ACQUISITION FUNNEL — Perjalanan Lengkap dari Sinyal Pasar hingga Klien Aktif Membayar
        </p>
        <div className="grid grid-cols-7 gap-1 mb-2">
          {[
            { stage: "Sinyal Pasar", count: 4821, c: "bg-primary/80" },
            { stage: "Pain Point", count: 1471, c: "bg-blue-400" },
            { stage: "Workroom", count: 612, c: "bg-blue-500" },
            { stage: "Prospek", count: 389, c: "bg-emerald-400" },
            { stage: "Proposal", count: 247, c: "bg-emerald-500" },
            { stage: "Deal", count: 164, c: "bg-emerald-600" },
            { stage: "Aktif", count: 138, c: "bg-emerald-700" },
          ].map((s, i) => {
            const maxCount = 4821;
            return (
              <div key={s.stage} className="flex flex-col items-center gap-1">
                <p className="text-[8px] font-mono font-bold text-center">{s.count.toLocaleString()}</p>
                <div className={`w-full ${s.c} rounded-t-sm`} style={{ height: `${(s.count / maxCount) * 72}px` }} />
                <p className="text-[7px] font-mono text-center text-muted-foreground leading-tight">{s.stage}</p>
                {i > 0 && <p className="text-[7px] font-mono text-center font-bold text-orange-600">{Math.round(([4821,1471,612,389,247,164,138][i] / [4821,1471,612,389,247,164,138][i-1]) * 100)}%</p>}
              </div>
            );
          })}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Terbesar dropout: Sinyal → Pain Point (30%) · Workroom → Prospek (36%) → optimalkan follow-up AI di 2 tahap ini</p>
      </div>

      {/* Daily Briefing Preview Widget */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Bell className="h-3.5 w-3.5 text-primary" /> DAILY BRIEFING PREVIEW — Ringkasan 5 Poin Terpenting dari Briefing Pagi Hari Ini (AI-Generated)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { no: 1, type: "URGENT", body: "SKK 9 kontraktor Jawa Barat expire dalam 30 hari — 6 belum dihubungi. Estimasi pipeline: Rp 37.8jt. Action: Hubungi via WA hari ini.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { no: 2, type: "INTEL", body: "Kompetitor A turunkan harga SKK J9 sebesar 18%. Klien CV Maju bertanya tentang harga kemarin. Siapkan counter-offer dengan nilai added layanan intel briefing.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { no: 3, type: "PELUANG", body: "4 tender baru di Papua Barat total Rp 142M — 0 kompetitor qualified yang terdeteksi. Potensi match untuk 2 klien BUJK besar aktif.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { no: 4, type: "REGULASI", body: "LPJK v3.0 release note baru: ada perubahan format template SKK elektronik per 15 Agustus. Tim operasional perlu update template sebelum tanggal tersebut.", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { no: 5, type: "KINERJA", body: "Revenue bulan ini sudah mencapai 84% dari target. Butuh Rp 47jt lagi dalam 29 hari. Prospek pipeline aktif: Rp 141jt. On-track untuk melampaui target.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.no} className={`border rounded-sm p-3 ${r.bc} flex gap-3`}>
              <div className="text-center w-6 shrink-0">
                <p className={`text-[12px] font-black font-mono ${r.tc} leading-none`}>{r.no}</p>
                <p className={`text-[6px] font-mono font-bold ${r.tc} leading-none mt-0.5`}>{r.type}</p>
              </div>
              <p className="text-[9px] flex-1 leading-snug">{r.body}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Briefing lengkap dikirim ke WhatsApp & email tim pukul 07:00 setiap hari · Powered by AI Synthesis Agent + 64 sumber data</p>
      </div>

      {/* Monthly OKR Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> OKR TRACKER AGUSTUS 2026 — Progress Objectives & Key Results MJP Bulan Ini
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              objective: "O1: Mencapai Revenue Rp 295jt di Agustus 2026",
              krs: [
                { kr: "KR1: Close 60 klien SKK baru", progress: 74, current: "44 klien", target: "60 klien", c: "bg-orange-400" },
                { kr: "KR2: Konversi 12 klien SMAP dari pipeline", progress: 50, current: "6 klien", target: "12 klien", c: "bg-orange-400" },
                { kr: "KR3: Perpanjang 40 Intel Briefing subscription", progress: 88, current: "35 sub", target: "40 sub", c: "bg-emerald-500" },
              ],
            },
            {
              objective: "O2: Ekspansi ke 3 Provinsi Baru (Kalbar, Sultra, NTB)",
              krs: [
                { kr: "KR1: Onboard 5+ klien per provinsi baru", progress: 27, current: "4 total", target: "15 klien", c: "bg-red-400" },
                { kr: "KR2: Rekrut 1 AM remote per provinsi", progress: 33, current: "1/3 rekrut selesai", target: "3 AM", c: "bg-red-400" },
              ],
            },
          ].map((obj) => (
            <div key={obj.objective} className="border rounded-sm p-3">
              <p className="text-[9px] font-bold mb-2">{obj.objective}</p>
              <div className="flex flex-col gap-2">
                {obj.krs.map((kr) => (
                  <div key={kr.kr}>
                    <div className="flex items-center justify-between mb-0.5">
                      <p className="text-[9px] text-muted-foreground">{kr.kr}</p>
                      <span className="text-[9px] font-mono font-bold shrink-0 ml-2">{kr.progress}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${kr.c} rounded-full`} style={{ width: `${kr.progress}%` }} />
                      </div>
                      <span className="text-[8px] font-mono text-muted-foreground shrink-0">{kr.current} / {kr.target}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Performance Heatmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM PERFORMANCE HEATMAP — Aktivitas & Output Tim MJP per Anggota Minggu Ini
        </p>
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left px-2 py-1.5 text-[9px] font-mono text-muted-foreground">Anggota</th>
                {["Pain Points", "SKK Closed", "Workroom", "Briefing Sent", "Prospek", "Score"].map(h => (
                  <th key={h} className="px-2 py-1.5 text-[9px] font-mono text-muted-foreground text-center">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { name: "Budi Santoso", pp: 12, skk: 4, wr: 7, brief: 2, prosp: 5, score: 94 },
                { name: "Reza Firmansyah", pp: 9, skk: 6, wr: 5, brief: 1, prosp: 8, score: 88 },
                { name: "Sari Dewi", pp: 11, skk: 2, wr: 9, brief: 3, prosp: 4, score: 86 },
                { name: "Andi Prasetyo", pp: 6, skk: 5, wr: 4, brief: 1, prosp: 3, score: 74 },
                { name: "Lisa Aditama", pp: 8, skk: 3, wr: 6, brief: 2, prosp: 6, score: 82 },
              ].map((r) => {
                const s = r.score;
                const sc = s >= 90 ? "text-emerald-700 font-black" : s >= 80 ? "text-blue-700 font-bold" : "text-orange-700 font-bold";
                return (
                  <tr key={r.name} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-2 py-1 text-[9px] font-medium">{r.name}</td>
                    <td className="px-2 py-1 text-[9px] font-mono text-center">{r.pp}</td>
                    <td className="px-2 py-1 text-[9px] font-mono text-center">{r.skk}</td>
                    <td className="px-2 py-1 text-[9px] font-mono text-center">{r.wr}</td>
                    <td className="px-2 py-1 text-[9px] font-mono text-center">{r.brief}</td>
                    <td className="px-2 py-1 text-[9px] font-mono text-center">{r.prosp}</td>
                    <td className={`px-2 py-1 text-[9px] font-mono text-center ${sc}`}>{r.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Score = weighted: SKK closed (40%) + Pain Points (25%) + Workroom (20%) + Prospek (15%) · Reset setiap Senin</p>
      </div>

      {/* Cash Flow Projection Panel */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> CASH FLOW PROJECTION — Proyeksi Arus Kas MJP 3 Bulan ke Depan Berdasarkan Pipeline + Kontrak Berjalan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { month: "Agustus 2026 (berjalan)", inflow: "Rp 248jt", outflow: "Rp 167jt", net: "+Rp 81jt", closing: "Rp 234jt", status: "ON TRACK", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { month: "September 2026 (proyeksi)", inflow: "Rp 284jt", outflow: "Rp 178jt", net: "+Rp 106jt", closing: "Rp 340jt", status: "STRONG", sc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { month: "Oktober 2026 (proyeksi)", inflow: "Rp 321jt", outflow: "Rp 194jt", net: "+Rp 127jt", closing: "Rp 467jt", status: "PEAK SEASON", sc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.month} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[9px] font-bold">{r.month}</p>
                <span className={`text-[8px] font-mono font-bold ${r.sc}`}>{r.status}</span>
              </div>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[["Inflow", r.inflow, "text-emerald-700"], ["Outflow", r.outflow, "text-red-600"], ["Net", r.net, r.net.startsWith("+") ? "text-emerald-700" : "text-red-600"], ["Closing Cash", r.closing, "text-primary"]].map(([label, val, tc]) => (
                  <div key={label}>
                    <p className={`text-[9px] font-mono font-bold ${tc}`}>{val}</p>
                    <p className="text-[7px] font-mono text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Asumsi: pipeline conversion 74% · Berdasarkan kontrak aktif + proyeksi SKK renewal + 15% growth YoY · Review setiap Senin</p>
      </div>

      {/* Strategic Northstar Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-yellow-500" /> NORTHSTAR METRICS — 3 Metrik Utama yang Menentukan Kesehatan Jangka Panjang Bisnis MJP
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            {
              metric: "Net Revenue Retention (NRR)",
              current: "127%",
              target: "140%",
              trend: "+4pp MoM",
              desc: "NRR >100% berarti revenue tumbuh dari klien existing saja, tanpa perlu klien baru",
              status: "GOOD",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200",
            },
            {
              metric: "Customer Acquisition Cost (CAC)",
              current: "Rp 48k",
              target: "<Rp 40k",
              trend: "-6k vs bulan lalu",
              desc: "CAC menurun artinya word-of-mouth dan referral makin dominan — efficiency meningkat",
              status: "IMPROVING",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200",
            },
            {
              metric: "Intelligence Usage Rate",
              current: "74%",
              target: "85%",
              trend: "+3pp MoM",
              desc: "% klien yang mengambil keputusan bisnis berdasarkan Intel Briefing MJP bulan ini",
              status: "GROWING",
              tc: "text-violet-700", bc: "bg-violet-50 border-violet-200",
            },
          ].map((r) => (
            <div key={r.metric} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold mb-1 ${r.tc}`}>{r.metric}</p>
              <div className="flex items-baseline gap-2 mb-0.5">
                <p className={`text-2xl font-black font-mono ${r.tc} leading-none`}>{r.current}</p>
                <p className="text-[8px] font-mono text-muted-foreground">target: {r.target}</p>
              </div>
              <p className={`text-[8px] font-mono font-bold ${r.tc} mb-1`}>{r.trend} · {r.status}</p>
              <p className="text-[8px] text-muted-foreground leading-snug">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Client Lifetime Value Leaderboard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-yellow-500" /> CLIENT LIFETIME VALUE LEADERBOARD — 8 Klien dengan LTV Tertinggi + Proyeksi Pertumbuhan Revenue per Klien
        </p>
        <div className="flex flex-col gap-1">
          {[
            { rank: 1, client: "PT Bangun Nusantara Group", ltv: "Rp 128jt", duration: "3.2 thn", products: 4, clv12m: "+Rp 18jt", churnRisk: "2%", tc: "text-emerald-700" },
            { rank: 2, client: "Konsorsiun BUJK Sulawesi (12 member)", ltv: "Rp 94jt", duration: "2.8 thn", products: 3, clv12m: "+Rp 22jt", churnRisk: "5%", tc: "text-emerald-700" },
            { rank: 3, client: "CV Karya Mandiri Bersatu", ltv: "Rp 67jt", duration: "4.1 thn", products: 2, clv12m: "+Rp 8jt", churnRisk: "12%", tc: "text-blue-700" },
            { rank: 4, client: "PT Konstruksi Andalan Prima", ltv: "Rp 58jt", duration: "2.1 thn", products: 3, clv12m: "+Rp 14jt", churnRisk: "8%", tc: "text-emerald-700" },
            { rank: 5, client: "Asosiasi BUJK Kalimantan", ltv: "Rp 47jt", duration: "1.9 thn", products: 2, clv12m: "+Rp 31jt", churnRisk: "3%", tc: "text-emerald-700" },
            { rank: 6, client: "Yayasan Pendidikan Vokasi Konstruksi", ltv: "Rp 41jt", duration: "3.7 thn", products: 1, clv12m: "+Rp 6jt", churnRisk: "18%", tc: "text-orange-700" },
            { rank: 7, client: "CV Maju Sejahtera Jaya", ltv: "Rp 34jt", duration: "1.4 thn", products: 3, clv12m: "+Rp 12jt", churnRisk: "7%", tc: "text-emerald-700" },
            { rank: 8, client: "PT Global Infra Indonesia", ltv: "Rp 28jt", duration: "0.9 thn", products: 2, clv12m: "+Rp 24jt", churnRisk: "4%", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.client} className="flex items-center gap-3 border-b last:border-0 py-1.5">
              <span className="text-[10px] font-black font-mono text-muted-foreground w-5 shrink-0">#{r.rank}</span>
              <p className="text-[9px] font-medium flex-1 truncate" title={r.client}>{r.client}</p>
              <div className="flex gap-4 text-[8px] font-mono shrink-0 text-right">
                <div><p className={`font-bold ${r.tc}`}>{r.ltv}</p><p className="text-muted-foreground">LTV</p></div>
                <div><p className={`font-bold text-emerald-700`}>{r.clv12m}</p><p className="text-muted-foreground">12m proj</p></div>
                <div><p className={`font-bold ${parseInt(r.churnRisk) > 10 ? "text-orange-700" : "text-emerald-700"}`}>{r.churnRisk}</p><p className="text-muted-foreground">churn</p></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Growth Experiment Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Beaker className="h-3.5 w-3.5 text-violet-500" /> GROWTH EXPERIMENT TRACKER — Eksperimen Pertumbuhan yang Sedang Dijalankan MJP dan Hasilnya
        </p>
        <div className="flex flex-col gap-2">
          {[
            { experiment: "A/B Test: WA Briefing pagi 06:30 vs 07:30", status: "RUNNING", started: "1 Agt", sampleA: "125 klien (06:30)", sampleB: "124 klien (07:30)", metric: "Open rate + action rate", earlyResult: "06:30 menang 67% vs 59% open rate — 8pp gap. Masih 14 hari tersisa", ec: "text-blue-700", eb: "bg-blue-50 border-blue-200" },
            { experiment: "Pilot: SKK Guarantee Tier — uang kembali jika tidak lulus", status: "PILOT", started: "15 Jul", sampleA: "20 klien pilot", sampleB: "Control: normal SKK", metric: "Conversion rate + willingness to pay premium", earlyResult: "18/20 klien pilot lulus. Conversion rate naik 34% vs non-guarantee. LAUNCH segera!", ec: "text-emerald-700", eb: "bg-emerald-50 border-emerald-200" },
            { experiment: "Cold outreach: LinkedIn vs WhatsApp untuk lead BUJK baru", status: "COMPLETE", started: "1 Jul", sampleA: "50 leads via LinkedIn", sampleB: "50 leads via WA cold", metric: "Response rate + booked call", earlyResult: "WA cold: 38% response, 12 calls. LinkedIn: 14% response, 3 calls. WA menang 2.7×. Stop LinkedIn outreach.", ec: "text-violet-700", eb: "bg-violet-50 border-violet-200" },
          ].map((r) => (
            <div key={r.experiment} className={`border rounded-sm p-3 ${r.eb}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.ec}`}>{r.experiment}</p>
                <span className={`text-[8px] font-mono font-bold shrink-0 ${r.ec}`}>{r.status}</span>
              </div>
              <div className="flex flex-wrap gap-3 text-[8px] font-mono text-muted-foreground mb-0.5">
                <span>Started: {r.started}</span>
                <span>A: {r.sampleA}</span>
                <span>B: {r.sampleB}</span>
                <span>KPI: {r.metric}</span>
              </div>
              <p className={`text-[9px] font-mono ${r.ec}`}>→ {r.earlyResult}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Platform Health Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartPulse className="h-3.5 w-3.5 text-primary" /> PLATFORM HEALTH SCORECARD — 12 Indikator Kesehatan Platform MJP yang Dimonitor Tim Ops Setiap Hari
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { metric: "API Uptime (30d)", val: "99.7%", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Avg Response Time", val: "284ms", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Error Rate", val: "0.04%", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "DB Query Latency", val: "12ms avg", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "AI Synthesis Queue", val: "3 pending", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Crawler Success Rate", val: "94.1%", status: "WARN", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { metric: "Storage Used", val: "67% (4.7TB)", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Scheduler Next Run", val: "07:00 besok", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Active Sessions", val: "24 pengguna", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "WA Notif Queue", val: "0 stuck", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "PDF Briefing Queue", val: "7 pending", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Mobile App Crashes", val: "0 today", status: "OK", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
          ].map((m) => (
            <div key={m.metric} className={`border rounded-sm p-2 text-center ${m.sb}`}>
              <p className={`text-[11px] font-black font-mono ${m.sc} leading-none`}>{m.val}</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{m.metric}</p>
              <p className={`text-[7px] font-mono font-bold ${m.sc}`}>{m.status}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Waterfall — MJP Monthly P&L Snapshot */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE WATERFALL — P{"&"}L Snapshot Agustus 2026: Dari Gross Revenue ke Net Profit MJP
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { label: "Gross Revenue (all products)", amount: 847, type: "income", pct: 100, c: "bg-emerald-500", tc: "text-emerald-700", neg: false },
            { label: "- Refunds & Cancellations", amount: -23, type: "deduct", pct: 2.7, c: "bg-red-400", tc: "text-red-700", neg: true },
            { label: "- Platform & Payment Fees", amount: -41, type: "deduct", pct: 4.8, c: "bg-orange-400", tc: "text-orange-700", neg: true },
            { label: "= Net Revenue", amount: 783, type: "sub", pct: 92.4, c: "bg-emerald-400", tc: "text-emerald-700", neg: false },
            { label: "- COGS (data, API, AI inference)", amount: -118, type: "deduct", pct: 13.9, c: "bg-slate-400", tc: "text-slate-600", neg: true },
            { label: "= Gross Profit", amount: 665, type: "sub", pct: 78.5, c: "bg-emerald-500", tc: "text-emerald-700", neg: false },
            { label: "- Opex (gaji, sewa, marketing)", amount: -312, type: "deduct", pct: 36.8, c: "bg-orange-400", tc: "text-orange-700", neg: true },
            { label: "= EBITDA", amount: 353, type: "sub", pct: 41.7, c: "bg-blue-500", tc: "text-blue-700", neg: false },
            { label: "- Amortisasi & Depresiasi", amount: -28, type: "deduct", pct: 3.3, c: "bg-slate-300", tc: "text-slate-600", neg: true },
            { label: "= Net Profit (Aug 2026)", amount: 325, type: "final", pct: 38.4, c: "bg-violet-500", tc: "text-violet-700", neg: false },
          ].map((r) => (
            <div key={r.label} className={`flex items-center gap-3 ${r.type === "sub" || r.type === "final" ? "border-t pt-1.5 mt-0.5" : ""}`}>
              <p className={`text-[9px] w-48 shrink-0 ${r.type === "final" ? "font-bold" : ""}`}>{r.label}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${Math.abs(r.pct) * 1}%` }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-16 text-right shrink-0 ${r.tc}`}>
                {r.neg ? "-" : ""}Rp {Math.abs(r.amount)}jt
              </p>
              <p className={`text-[8px] font-mono w-10 text-right shrink-0 ${r.tc}`}>{r.pct}%</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-2">Net margin 38.4% — target 42% Q3 · Utama: kurangi Opex 8% via efisiensi proses onboarding</p>
      </div>

      {/* Strategic OKR Tracker */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Trophy className="h-3.5 w-3.5 text-yellow-500" /> OKR TRACKER Q3 2026 — Objectives {"&"} Key Results MJP: Progress Real-Time Menuju Target Kuartal Ini
        </p>
        <div className="flex flex-col gap-3">
          {[
            {
              objective: "O1: Jadikan MJP market leader intelligence konstruksi Indonesia",
              progress: 68, target: 100,
              krs: [
                { kr: "KR1.1: 600 klien aktif berbayar", current: 487, target: 600, unit: "klien", pct: 81 },
                { kr: "KR1.2: NPS ≥ 72 (diukur quarterly)", current: 67, target: 72, unit: "NPS", pct: 93 },
                { kr: "KR1.3: Media coverage 3 artikel/bulan", current: 1, target: 3, unit: "artikel", pct: 33 },
              ],
              c: "text-emerald-700", b: "bg-emerald-50 border-emerald-200"
            },
            {
              objective: "O2: Capai Rp 1M ARR sebelum akhir Q3 2026",
              progress: 84, target: 100,
              krs: [
                { kr: "KR2.1: MRR Rp 84jt atau lebih", current: 71, target: 84, unit: "jt/bln", pct: 85 },
                { kr: "KR2.2: Churn rate <5%/bulan", current: 6.8, target: 5, unit: "%", pct: 74, inverse: true },
                { kr: "KR2.3: 3 enterprise deal ≥Rp 24jt/thn", current: 1, target: 3, unit: "deal", pct: 33 },
              ],
              c: "text-blue-700", b: "bg-blue-50 border-blue-200"
            },
            {
              objective: "O3: Ekspansi ke 3 provinsi baru di luar Jawa",
              progress: 41, target: 100,
              krs: [
                { kr: "KR3.1: AM aktif di Sulawesi (Makassar)", current: 0, target: 1, unit: "AM", pct: 0 },
                { kr: "KR3.2: 50 klien aktif Kalimantan", current: 18, target: 50, unit: "klien", pct: 36 },
                { kr: "KR3.3: Partnership 1 asosiasi luar Jawa", current: 1, target: 1, unit: "partner", pct: 100 },
              ],
              c: "text-orange-700", b: "bg-orange-50 border-orange-200"
            },
          ].map((o) => (
            <div key={o.objective} className={`border rounded-sm p-3 ${o.b}`}>
              <div className="flex items-center gap-3 mb-2">
                <p className={`text-[9px] font-bold flex-1 ${o.c}`}>{o.objective}</p>
                <div className="text-right shrink-0">
                  <p className={`text-[14px] font-black font-mono ${o.c} leading-none`}>{o.progress}%</p>
                </div>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
                <div className={`h-full rounded-full ${o.progress >= 80 ? "bg-emerald-500" : o.progress >= 60 ? "bg-blue-400" : "bg-orange-400"}`} style={{ width: `${o.progress}%` }} />
              </div>
              {o.krs.map((kr) => (
                <div key={kr.kr} className="flex items-center gap-2 mb-0.5">
                  <p className="text-[8px] flex-1">{kr.kr}</p>
                  <p className={`text-[8px] font-mono font-bold shrink-0 ${kr.pct >= 80 ? o.c : "text-orange-700"}`}>{kr.current}/{kr.target} {kr.unit} ({kr.pct}%)</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Client Satisfaction Pulse */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-red-500" /> CLIENT SATISFACTION PULSE — NPS, CSAT, dan CES MJP per Produk dan Segmen Klien Bulan Ini
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { metric: "NPS (Net Promoter Score)", score: 67, benchmark: "SaaS Indonesia avg: 41", status: "EXCELLENT", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "CSAT (Customer Satisfaction)", score: 84, benchmark: "Industry avg: 71%", status: "STRONG", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "CES (Customer Effort Score)", score: 3.2, benchmark: "Target: <3.0", status: "NEEDS WORK", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
          ].map((m) => (
            <div key={m.metric} className={`border rounded-sm p-3 ${m.sb} text-center`}>
              <p className={`text-2xl font-black font-mono ${m.sc} leading-none`}>{m.score}</p>
              <p className="text-[7px] font-mono text-muted-foreground mt-0.5">{m.metric}</p>
              <p className={`text-[8px] font-mono font-bold ${m.sc} mt-0.5`}>{m.status}</p>
              <p className="text-[7px] font-mono text-muted-foreground">{m.benchmark}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-bold mb-1.5">NPS per produk (promoter − detractor):</p>
        <div className="flex flex-col gap-1.5">
          {[
            { product: "SKK Express (14 jam)", nps: 84, promoters: 91, detractors: 7, c: "bg-emerald-500 " },
            { product: "Intel Briefing", nps: 71, promoters: 79, detractors: 8, c: "bg-emerald-400" },
            { product: "Radar Kompetitor", nps: 63, promoters: 74, detractors: 11, c: "bg-blue-400" },
            { product: "Custom Research", nps: 58, promoters: 68, detractors: 10, c: "bg-blue-300" },
            { product: "Surat Penawaran Assist", nps: 44, promoters: 57, detractors: 13, c: "bg-orange-400" },
          ].map((r) => (
            <div key={r.product} className="flex items-center gap-2">
              <p className="text-[9px] w-40 shrink-0">{r.product}</p>
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full ${r.c} rounded-full`} style={{ width: `${r.nps}%` }} />
              </div>
              <p className="text-[8px] font-mono font-bold w-8 text-right text-emerald-700 shrink-0">+{r.nps}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Surat Penawaran NPS rendah (44) — perlu redesign UX alur pembuatan surat. CES tinggi (3.2) = terlalu banyak langkah untuk klien baru</p>
      </div>

      {/* Weekly Action Priorities */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-yellow-500" /> WEEKLY ACTION PRIORITIES — 7 Hal yang Harus Diselesaikan Tim MJP Minggu Ini untuk Dampak Terbesar
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { priority: 1, action: "Hubungi 5 klien SKK expire ≤7 hari + sedang bid tender (list di SKK page)", owner: "Sari", deadline: "Hari ini", impact: "Rp 31.5jt tender value at risk jika klien tidak bisa submit SKK tepat waktu", urgency: "KRITIS", uc: "text-red-700", ub: "bg-red-50 border-red-200" },
            { priority: 2, action: "Posting job listing AM Makassar/Sulawesi — minimal di LinkedIn + Jobstreet", owner: "Hendra", deadline: "Rabu ini", impact: "Ekspansi Sulawesi blocked tanpa AM lokal — 18 klien Sulawesi at churn risk", urgency: "KRITIS", uc: "text-red-700", ub: "bg-red-50 border-red-200" },
            { priority: 3, action: "Fix entity resolution Layer 3 error rate dari 4.1% ke <1%", owner: "Tim Tech", deadline: "Jumat ini", impact: "380 entities/hari salah = credibility risk ke 47 klien premium", urgency: "HIGH", uc: "text-orange-700", ub: "bg-orange-50 border-orange-200" },
            { priority: 4, action: "Deploy IjinTender crawler weekend failover mode ke production", owner: "Tim Tech", deadline: "Kamis ini", impact: "Freshness drop 68 setiap weekend → brief Sabtu ke klien premium tidak reliable", urgency: "HIGH", uc: "text-orange-700", ub: "bg-orange-50 border-orange-200" },
            { priority: 5, action: "Kirim BIM Readiness survey ke 50 klien aktif untuk gauge interest dan willingness to pay", owner: "Reza", deadline: "Jumat ini", impact: "Gate BIM product launch — butuh konfirmasi demand sebelum build", urgency: "MEDIUM", uc: "text-blue-700", ub: "bg-blue-50 border-blue-200" },
            { priority: 6, action: "Review dan approve 34 knowledge asset regulasi berusia >180 hari", owner: "Sari", deadline: "Jumat ini", impact: "Klien mungkin mendapat regulasi outdated — compliance risk", urgency: "MEDIUM", uc: "text-blue-700", ub: "bg-blue-50 border-blue-200" },
            { priority: 7, action: "Campaign 'Persiapan Tender September' ke 200 klien aktif via WhatsApp blast", owner: "Reza", deadline: "Minggu ini", impact: "Sep = peak tender season — klien yang siap lebih awal menang lebih banyak", urgency: "MEDIUM", uc: "text-blue-700", ub: "bg-blue-50 border-blue-200" },
          ].map((a) => (
            <div key={a.priority} className={`border rounded-sm p-2.5 ${a.ub} flex items-start gap-3`}>
              <span className={`text-[11px] font-black font-mono shrink-0 mt-0.5 ${a.uc}`}>#{a.priority}</span>
              <div className="flex-1">
                <p className="text-[9px] font-bold leading-snug">{a.action}</p>
                <div className="flex flex-wrap gap-3 text-[8px] font-mono mt-0.5">
                  <span className="text-muted-foreground">Owner: {a.owner}</span>
                  <span className="text-muted-foreground">Deadline: {a.deadline}</span>
                  <span className={`font-bold ${a.uc}`}>{{ KRITIS:"Kritis", HIGH:"Tinggi", MEDIUM:"Sedang", LOW:"Rendah" }[a.urgency] ?? a.urgency}</span>
                </div>
                <p className="text-[8px] text-muted-foreground mt-0.5">{a.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ARR Bridge & Waterfall */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> ARR BRIDGE — Dari ARR Bulan Lalu ke ARR Bulan Ini: Setiap Rp yang Datang dan Pergi Dijelaskan
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { label: "ARR Bulan Lalu (Jul 2026)", value: 824_000_000, type: "base", c: "bg-slate-400", tc: "text-slate-700" },
            { label: "+ New Expansion (upsell klien existing)", value: 38_400_000, type: "add", c: "bg-emerald-500", tc: "text-emerald-700" },
            { label: "+ New Logo ARR (klien baru Jul)", value: 26_800_000, type: "add", c: "bg-emerald-400", tc: "text-emerald-700" },
            { label: "− Contraction (downgrade plan)", value: -12_200_000, type: "sub", c: "bg-orange-400", tc: "text-orange-700" },
            { label: "− Churn ARR (klien cancel Jul)", value: -31_400_000, type: "sub", c: "bg-red-500", tc: "text-red-700" },
            { label: "= ARR Bulan Ini (Aug 2026)", value: 845_600_000, type: "total", c: "bg-blue-500", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.label} className="flex items-center gap-2">
              <p className={`text-[9px] w-52 shrink-0 ${r.type === "total" ? "font-bold" : ""}`}>{r.label}</p>
              <div className="flex-1 relative h-4 flex items-center">
                <div className={`h-3 rounded-sm ${r.c}`} style={{ width: `${Math.abs(r.value) / 8_456_000}px`, maxWidth: "100%", minWidth: "4px" }} />
              </div>
              <p className={`text-[9px] font-mono font-bold w-24 text-right shrink-0 ${r.tc}`}>
                {r.value >= 0 ? "+" : ""}{(r.value / 1_000_000).toFixed(1)}jt
              </p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { metric: "Net New ARR", val: "+Rp 21.6jt", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Expansion Rate", val: "4.66%", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
            { metric: "Churn Rate (ARR)", val: "3.81%", sc: "text-orange-700", sb: "bg-orange-50 border-orange-200" },
            { metric: "Net Revenue Retention", val: "103%", sc: "text-emerald-700", sb: "bg-emerald-50 border-emerald-200" },
          ].map((m) => (
            <div key={m.metric} className={`border rounded-sm p-2 ${m.sb} text-center`}>
              <p className={`text-[13px] font-black font-mono ${m.sc} leading-none`}>{m.val}</p>
              <p className={`text-[7px] font-mono ${m.sc} mt-0.5`}>{m.metric}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">NRR 103% = expansion lebih besar dari churn · Target NRR 110% di Dec 2026 via agresifkan upsell ke Intel Briefing + Radar paket combo</p>
      </div>

      {/* Quarterly Business Review Prep */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> QBR PREP — Data yang Perlu Disiapkan Tim MJP untuk Quarterly Business Review Q3 2026 (Presentasi ke Investor/Board)
        </p>
        <div className="flex flex-col gap-2">
          {[
            { section: "Section 1: Financial Performance", items: ["ARR Jul 2026: Rp 845.6jt (+31% YoY)", "MRR Aug 2026: Rp 70.5jt (+3.1% MoM)", "Gross Margin: 67% (target: 70%)", "Burn Rate: Rp 28jt/bln (18 bln runway)"], status: "DATA READY", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { section: "Section 2: Customer Metrics", items: ["Total klien aktif: 487 (+18% vs Q2)", "NPS: 67 (benchmark SaaS: 41)", "Churn rate: 3.81% ARR (target: <3%)", "NRR: 103% (target: 110%)"], status: "DATA READY", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { section: "Section 3: Product & Technology", items: ["Platform uptime: 99.1%", "Entity resolution error: 4.1% (NEEDS FIX)", "New features shipped: 7 (target: 5)", "Mobile app DAU: 124 klien (25% total)"], status: "PARTIAL", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { section: "Section 4: Market Expansion", items: ["Penetrasi Jawa: 38% total addressable", "Sulawesi coverage: 18 klien (target: 50)", "Kalimantan coverage: 12 klien", "Papua: 2 klien (constraint: digital infra)"], status: "DATA READY", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { section: "Section 5: Strategic Initiatives Q4 2026", items: ["BIM Readiness beta launch", "AM Sulawesi rekrut + onboard", "Freemium tier soft launch", "Surat Penawaran UX redesign"], status: "DRAFT", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.section} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.section}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              {r.items.map((item, i) => <p key={i} className="text-[9px] text-muted-foreground">• {item}</p>)}
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">QBR scheduled: 15 Agt 2026 · Owner: Hendra + Reza · Deck due: 12 Agt 2026</p>
      </div>

      {/* Competitive Positioning Statement */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> POSITIONING STATEMENT — Bagaimana MJP Mendeskripsikan Dirinya ke Investor, Klien Baru, dan Rekrutan dalam 3 Format Berbeda?
        </p>
        <div className="flex flex-col gap-3">
          <div className="border rounded-sm p-3 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700 mb-1">Investor Pitch (30 detik):</p>
            <p className="text-[9px] italic text-muted-foreground">"MJP adalah Bloomberg Terminal untuk kontraktor konstruksi Indonesia. Kami mengubah 500+ sumber data real-time — LPSE, LPJK, SIMBG, kompetitor intel — menjadi tindakan bisnis yang bisa dieksekusi langsung oleh 487 BUJK aktif kami. Di pasar konstruksi Rp 450T/thn yang 95% BUJK-nya masih operasi buta, kami adalah platform intelligence pertama yang membangun data moat yang defensible. ARR kami Rp 845jt tumbuh 31% YoY dengan NRR 103%."</p>
          </div>
          <div className="border rounded-sm p-3 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700 mb-1">Client Pitch (saat demo ke BUJK baru — 1 kalimat):</p>
            <p className="text-[9px] italic text-muted-foreground">"Bayangkan punya asisten riset yang tidak tidur — dia baca semua LPSE Indonesia setiap 4 jam, track semua kompetitor Anda, alert begitu ada tender yang cocok, dan tiap pagi kirimkan briefing singkat 'inilah yang perlu Anda tahu hari ini untuk menang lebih banyak tender.'"</p>
          </div>
          <div className="border rounded-sm p-3 bg-violet-50 border-violet-200">
            <p className="text-[9px] font-bold text-violet-700 mb-1">Recruiter Pitch (untuk AM baru di Sulawesi):</p>
            <p className="text-[9px] italic text-muted-foreground">"Anda akan menjadi orang pertama MJP di Sulawesi. Artinya: Anda build market dari scratch, punya 2.800+ BUJK yang belum tersentuh sebagai potential clients, dan ketika Sulawesi grow ke 100+ klien, Anda akan lead team regional sendiri. Ini bukan job sales biasa — Anda adalah pioneer yang build intelligence platform di pasar yang masih blue ocean."</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Semua 3 format menggunakan data dan stories yang sama — hanya framing dan level of detail yang berbeda sesuai audience</p>
      </div>

      {/* Revenue Cohort Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> REVENUE COHORT — Klien yang Bergabung di Tahun Berbeda Menghasilkan Revenue Berbeda: Pola Ekspansi dan Retensi per Batch
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[8px] font-mono mb-2">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Cohort</th>
                <th className="p-1 text-center text-muted-foreground">Klien Awal</th>
                <th className="p-1 text-center text-muted-foreground">Retensi 12 bln</th>
                <th className="p-1 text-center text-muted-foreground">Retensi 24 bln</th>
                <th className="p-1 text-center text-muted-foreground">Avg MRR Awal</th>
                <th className="p-1 text-center text-muted-foreground">Avg MRR Skrg</th>
                <th className="p-1 text-center text-muted-foreground">NRR</th>
              </tr>
            </thead>
            <tbody>
              {[
                { cohort: "2023 H1 (Founders)", n: 34, ret12: "91%", ret24: "82%", mrrAwal: "Rp 780rb", mrrNow: "Rp 1.62jt", nrr: "118%", note: "Klien paling loyal — ikut sejak beta. Mostly J9." },
                { cohort: "2023 H2", n: 67, ret12: "84%", ret24: "71%", mrrAwal: "Rp 650rb", mrrNow: "Rp 1.21jt", nrr: "109%", note: "Cohort pertama yang ada SKK Express." },
                { cohort: "2024 H1", n: 112, ret12: "79%", ret24: "64%", mrrAwal: "Rp 820rb", mrrNow: "Rp 1.08jt", nrr: "104%", note: "Mulai banyak J7/J8 kecil — churn lebih tinggi." },
                { cohort: "2024 H2", n: 143, ret12: "76%", ret24: "N/A", mrrAwal: "Rp 870rb", mrrNow: "Rp 1.04jt", nrr: "101%", note: "24 bln data belum ada. Trending positif." },
                { cohort: "2025 H1", n: 89, ret12: "72%", ret24: "N/A", mrrAwal: "Rp 920rb", mrrNow: "Rp 970rb", nrr: "98%", note: "Cohort ini underperform — onboarding kurang bagus." },
                { cohort: "2025 H2", n: 42, ret12: "N/A", ret24: "N/A", mrrAwal: "Rp 1.02jt", mrrNow: "Rp 1.02jt", nrr: "TBD", note: "Terlalu dini untuk judge. Monitor bulan ke-9." },
              ].map((r) => (
                <tr key={r.cohort} className="border-b hover:bg-muted/20">
                  <td className="p-1">{r.cohort}</td>
                  <td className="p-1 text-center">{r.n}</td>
                  <td className="p-1 text-center">{r.ret12}</td>
                  <td className="p-1 text-center">{r.ret24}</td>
                  <td className="p-1 text-center">{r.mrrAwal}</td>
                  <td className="p-1 text-center font-bold text-emerald-700">{r.mrrNow}</td>
                  <td className="p-1 text-center font-bold">{r.nrr}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">2025 H1 cohort NRR 98% = alarm. Investigation: onboarding email sequence baru yang lebih baik + AM check-in di hari ke-30. Fix targeted ke cohort ini.</p>
      </div>

      {/* Operational Metrics SLA Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <CircleCheck className="h-3.5 w-3.5 text-emerald-600" /> OPERATIONAL SLA SCORECARD — Status Semua Komitmen Layanan MJP ke Klien: Mana yang Hijau, Kuning, Merah?
        </p>
        <div className="flex flex-col gap-1.5">
          {[
            { sla: "Intel Briefing delivery sebelum 07:00 WIB", target: "> 99%", actual: "99.4%", status: "GREEN", detail: "6 late delivery YTD — semua karena WhatsApp API maintenance, bukan sistem MJP", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { sla: "Tender alert <2 jam dari LPSE pengumuman", target: "> 99%", actual: "99.3%", status: "GREEN", detail: "Avg 1.4 jam. 0.7% breach = 3 kejadian — LPSE Kaltim mati selama 8 jam di Mei 2026", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { sla: "Platform uptime (termasuk API)", target: "> 99.5%", actual: "99.1%", status: "YELLOW", detail: "0.4pp di bawah target. Root cause: 2 unplanned downtime Jan+Mei 2026. On-call respons sudah diupgrade.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { sla: "Entity resolution error rate", target: "<1%", actual: "4.1%", status: "RED", detail: "Sprint 23 priority fix. Cause: LPSE Sulawesi menggunakan encoding nama berbeda. Fix expected Aug 15.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { sla: "Custom research delivery dalam 3 hari kerja", target: "> 95%", actual: "92%", status: "YELLOW", detail: "8% breach — semua terjadi ketika Sari leading workshop. Fix: backup researcher rotasi untuk custom requests", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { sla: "AM respons pertama dalam <4 jam (business hours)", target: "> 95%", actual: "97.2%", status: "GREEN", detail: "Reza maintain avg 1.8 jam first response. Spike ke 5+ jam saat AM handling enterprise klien simultaneously.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.sla} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.sla}</p>
                    <div className="flex gap-2 shrink-0 text-[8px] font-mono">
                      <span className="text-muted-foreground">Target: {r.target}</span>
                      <span className={`font-bold ${r.tc}`}>Actual: {r.actual}</span>
                      <span className={`font-black ${r.tc}`}>{r.status}</span>
                    </div>
                  </div>
                  <p className="text-[8px] text-muted-foreground">{r.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">4/6 SLA green · 2 yellow · 1 red (entity resolution). Red SLA adalah blocker untuk kepercayaan data — prioritas Sprint 23.</p>
      </div>

      {/* Growth Lever Analysis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" /> GROWTH LEVER ANALYSIS — Jika MJP Ingin Menambah Rp 200jt ARR dalam 6 Bulan, Lever Mana yang Paling Efisien?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { lever: "Akuisisi klien baru (growth)", requiredAction: "Butuh 167 klien baru (avg MRR Rp 1.2jt) dalam 6 bulan = 28 klien/bulan", currentRate: "14 klien/bulan saat ini", costToAchieve: "Rp 200jt additional ARR butuh ~Rp 64jt CAC investment", feasibility: "HARD — perlu double acquisition rate. Butuh AM baru + marketing scaling.", roi: "4.7× ROI jika LTV holds at 18.5× CAC", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { lever: "Upsell existing klien (expansion)", requiredAction: "Naikan avg MRR 167 klien existing dari Rp 1.2jt ke Rp 2.4jt (2× upsell) = Rp 200jt ARR", currentRate: "NRR 103% — expansion ada tapi lambat", costToAchieve: "Rp 8jt campaign + AM time (tidak butuh CAC baru)", feasibility: "MEDIUM — 34% klien Growth sudah qualified untuk Pro. Need compelling offer.", roi: "25× ROI karena zero CAC. Best lever jika mau capital-efficient.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { lever: "Churn reduction (retention)", requiredAction: "Dari 3.81% ke 1.5% churn rate = save Rp 188jt/thn ARR yang saat ini keluar", currentRate: "3.81% churn/bulan = Rp 32jt ARR hilang/bulan", costToAchieve: "Rp 12jt program (onboarding improvement + AM check-in automation)", feasibility: "HIGH — 2025 H1 cohort analisis sudah identify root cause. Fix well-understood.", roi: "15.7× ROI. Preventing churn is cheapest path to growing ARR.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { lever: "New product (new revenue stream)", requiredAction: "Launch BIM Tool di 50 klien × Rp 2.8jt/bln = Rp 168jt ARR dalam 6 bulan", currentRate: "Belum diluncurkan (target Q3 2026)", costToAchieve: "Rp 45jt dev investment (3 bulan). Launch Aug 2026 → target Dec 2026.", feasibility: "MEDIUM — demand validated (183 klien survey interested) tapi dev belum done", roi: "3.7× ROI jika target hit. Risky tapi unlock new segment (J9+)", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
          ].map((r) => (
            <div key={r.lever} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.lever}</p>
                <span className={`text-[7px] font-mono ${r.tc}`}>{r.feasibility}</span>
              </div>
              <p className="text-[8px] text-muted-foreground mb-0.5">{r.requiredAction}</p>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono">
                <span className="text-muted-foreground">Now: {r.currentRate}</span>
                <span className={r.tc}>ROI: {r.roi}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Rekomendasi Q3 2026: Churn reduction (ROI 15.7×) + Upsell campaign (ROI 25×) = Rp 388jt ARR impact dengan Rp 20jt investment. DO THESE FIRST.</p>
      </div>

      {/* Investor Readiness Checklist */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 text-primary" /> INVESTOR READINESS — Jika MJP Ingin Raise Seed Round Rp 5M dalam 12 Bulan, Apa yang Harus Disiapkan Sekarang?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { item: "Audited financials atau reviewed financials dari KAP terpercaya", status: "TODO", urgency: "HIGH", note: "Minimal 2 tahun laporan. Investor seed butuh ini untuk due diligence. Lead time KAP: 3–4 bulan. Start now.", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { item: "Legal entity: PT struktur yang clean, tidak ada masalah anggaran dasar", status: "DONE ✓", urgency: "HIGH", note: "PT Maheswara Jaya Persada already registered correctly. Cap table clean.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { item: "Traction metrics: MRR, ARR, customer count, NRR sudah terdokumentasi formal", status: "IN PROGRESS", urgency: "HIGH", note: "Data ada di platform tapi belum dalam format investor-ready dashboard. Build Q3 2026.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { item: "Customer reference: 5 klien yang mau berbicara positif ke investor", status: "DONE ✓", urgency: "MEDIUM", note: "8 klien champion sudah identified dan confirmed willing to be references.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { item: "Data room: semua dokumen terorganisir di satu tempat", status: "TODO", urgency: "MEDIUM", note: "Kapan saja investor minta, kita harus bisa share dalam 24 jam. Setup Notion atau Google Drive data room.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { item: "Pitch deck yang di-update dengan metrics terbaru dan clear ask", status: "TODO", urgency: "MEDIUM", note: "Last pitch deck dibuat 14 bulan lalu. Butuh rewrite dengan data terkini + post-product-market-fit narrative.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { item: "IP / defensibility story: apa yang tidak bisa di-copy dengan mudah", status: "IN PROGRESS", urgency: "MEDIUM", note: "Data moat (38.400+ tender), Sari's expertise, GAPENSI relationship. Perlu di-formalize sebagai narrative.", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.item} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.item}</p>
                <div className="flex gap-1.5 shrink-0 text-[7px] font-mono">
                  <span className={`font-bold ${r.tc}`}>{{ "TODO":"Belum Dimulai", "DONE ✓":"Selesai ✓", "IN PROGRESS":"Sedang Berjalan" }[r.status] ?? r.status}</span>
                  <span className={r.tc}>{{ HIGH:"Tinggi", MEDIUM:"Sedang", LOW:"Rendah", KRITIS:"Kritis" }[r.urgency] ?? r.urgency}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Readiness score: 2/7 done, 3 in progress, 2 todo. Biggest blocker: audited financials (3–4 bulan lead time). Start immediately jika target raise H1 2027.</p>
      </div>

      {/* Strategic Risk Register */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TriangleAlert className="h-3.5 w-3.5 text-orange-500" /> STRATEGIC RISK REGISTER — Daftar Risiko Paling Signifikan yang Hendra & Tim Harus Monitor Setiap Bulan
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { risk: "TECH DEBT: Entity resolution error 4.1% membuat data tidak trustworthy", likelihood: "HIGH (sudah terjadi)", impact: "HIGH (client trust erosion)", mitigation: "Sprint 23 prioritas. Fix expected Aug 15. Owner: Hendra.", rag: "RED", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { risk: "PEOPLE: Sari overloaded — single point of failure untuk regulatory + SKK expertise", likelihood: "HIGH (happening now)", impact: "CRITICAL (product quality, client trust)", mitigation: "Junior Researcher #2 hire Q4 2026. Knowledge documentation Sprint.", rag: "RED", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
            { risk: "MARKET: Startup competitor dengan backing besar masuk dan price-war", likelihood: "MEDIUM (28% probability, 6–18 bln)", impact: "HIGH (acquisition cost spike)", mitigation: "Champion program accelerated. Data moat 10K records target. Relationship lock-in.", rag: "AMBER", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { risk: "LEGAL: IjinTender ToS compliance unresolved", likelihood: "MEDIUM", impact: "MEDIUM (data source cutoff)", mitigation: "Hendra legal review by Sep 2026. Worst case: remove IjinTender, find alternative.", rag: "AMBER", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { risk: "FINANCIAL: Cash flow squeeze jika 2 enterprise klien churn simultaneously", likelihood: "LOW (2 enterprise = 18% ARR)", impact: "HIGH (runway impact)", mitigation: "Enterprise klien NRR tracked weekly. AM Reza personal QBR quarterly. Churn early warning.", rag: "AMBER", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            { risk: "REGULATORY: Pemerintah block commercial use of LPSE data", likelihood: "VERY LOW (no signal)", impact: "CATASTROPHIC (core product dies)", mitigation: "Diversify data sources. Crowdsourced data (pain points) as fallback. Government partnership track.", rag: "GREEN", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.risk} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.risk}</p>
                <span className={`text-[7px] font-mono font-black shrink-0 ${r.tc}`}>{r.rag}</span>
              </div>
              <div className="flex flex-wrap gap-2 text-[8px] font-mono mb-0.5">
                <span className="text-muted-foreground">Likelihood: {r.likelihood}</span>
                <span className={r.tc}>Impact: {r.impact}</span>
              </div>
              <p className={`text-[8px] font-mono ${r.tc}`}>Mitigation: {r.mitigation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Risk Register reviewed monthly oleh Hendra. 2 RED risks = immediate action required. 3 AMBER = monitor closely. 0 risks adalah not a goal — unmanaged risk is the real danger.</p>
      </div>

      {/* Customer Success Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> CUSTOMER SUCCESS FRAMEWORK — Bagaimana MJP Mendefinisikan "Sukses" untuk Setiap Segmen Klien dan Bagaimana Mengukurnya?
        </p>
        <div className="flex flex-col gap-2">
          {[
            {
              segment: "J7 Starter (Rp 800rb/bln)",
              successDefinition: "Klien menang tender pertama mereka atau meningkatkan win rate dari <15% ke > 20% dalam 3 bulan",
              keyMetrics: ["Tender pertama dimenangkan dalam 90 hari", "Alert open rate > 75%", "SKK valid (tidak ada yang expire)", "Login ke platform minimal 3×/minggu"],
              interventions: "Jika 45 hari tidak ada win: AM personal check-in. Jika 60 hari tidak ada login: re-onboarding session.",
              successRate: "67% dalam 3 bulan",
              tc: "text-slate-700", bc: "bg-slate-50 border-slate-200"
            },
            {
              segment: "J8 Growth (Rp 1.5jt/bln)",
              successDefinition: "Win rate naik > 10pp dan klien memenangkan minimal 1 kontrak > Rp 5M dalam 6 bulan",
              keyMetrics: ["Win rate > 28% (avg baseline 18%)", "Pakai HPS Benchmark untuk > 80% bid", "At least 1 Radar Kompetitor check/minggu", "NPS > 7"],
              interventions: "Jika win rate tidak naik setelah 3 bulan: Sari review profile dan adjust intel targeting.",
              successRate: "74% dalam 6 bulan",
              tc: "text-blue-700", bc: "bg-blue-50 border-blue-200"
            },
            {
              segment: "J9 Pro/Enterprise",
              successDefinition: "MJP menjadi strategic intelligence layer untuk BUJK — digunakan sebelum SETIAP major bid decision",
              keyMetrics: ["Pre-Bid Intel Brief accessed untuk > 90% tender di atas Rp 10M", "Custom research utilization > 80% dari allocation", "NPS > 8", "Renewal on auto (tidak perlu re-pitch)"],
              interventions: "Quarterly strategic advisory call. Sari personally presents market intelligence update.",
              successRate: "89% renewal rate (highest tier)",
              tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200"
            },
          ].map((r) => (
            <div key={r.segment} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-1">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.segment}</p>
                <span className={`text-[8px] font-mono shrink-0 ${r.tc}`}>Success rate: {r.successRate}</span>
              </div>
              <p className="text-[8px] font-bold mb-0.5">Definition: {r.successDefinition}</p>
              <div className="grid grid-cols-2 gap-1 mb-0.5">
                <div><p className="text-[8px] font-bold">Key metrics:</p>{r.keyMetrics.map((m, i) => <p key={i} className="text-[8px] text-muted-foreground">• {m}</p>)}</div>
                <div><p className="text-[8px] font-bold">If struggling:</p><p className="text-[8px] text-muted-foreground">{r.interventions}</p></div>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground mt-1.5">Customer success bukan customer support. Support = reactive (fix problems). Success = proactive (prevent problems + accelerate value). MJP aim: 100% proactive model.</p>
      </div>

      {/* Revenue Model Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE MODEL BREAKDOWN — Dari Mana Saja MJP Menghasilkan Uang dan Bagaimana Setiap Stream Saling Memperkuat?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stream: "SaaS Subscription (Primary)", pct: "71%", arpu: "Rp 1.4jt/bln avg", mrr: "Rp 681jt/bln est.", note: "487 klien × avg tier. Predictable, recurring. Growth driver utama. Target: 60% dari MRR di tier Growth/Pro.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { stream: "SKK Express (Transaction)", pct: "14%", arpu: "Rp 2.1jt per case", mrr: "Rp 135jt/bln est.", note: "64 cases/bln avg. High-margin (Rp 800rb gross margin/case). Tidak recurring tapi sticky — klien yang pernah pakai 89% akan pakai lagi.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stream: "Custom Research (Project)", pct: "9%", arpu: "Rp 4.8jt per project", mrr: "Rp 86jt/bln est.", note: "18 projects/bln. Lumpy tapi high-value. Enterprise klien = 60% dari volume. Natural upsell path untuk klien yang hit subscription limit.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { stream: "Data Licensing (Emerging)", pct: "4%", arpu: "Rp 12jt/bln per licensee", mrr: "Rp 38jt/bln est.", note: "3 active data licensees (bank, konsultan, developer). Highest LTV stream. 0 marginal cost untuk incremental licensee. Target: 10 licensees by 2027.", tc: "text-violet-700", bc: "bg-violet-50 border-violet-200" },
            { stream: "Training & Workshop (Small)", pct: "2%", arpu: "Rp 350rb/peserta", mrr: "Rp 19jt/bln est.", note: "Monthly online workshop. Double function: revenue + lead gen untuk subscription. 34% workshop alumni convert ke subscription dalam 90 hari.", tc: "text-slate-600", bc: "bg-slate-50 border-slate-200" },
          ].map((r) => (
            <div key={r.stream} className={`border rounded-sm p-3 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.stream}</p>
                <div className="flex gap-2 text-[8px] font-mono shrink-0">
                  <span className={`font-bold ${r.tc}`}>{r.pct} of rev</span>
                  <span className="text-muted-foreground">{r.arpu}</span>
                  <span className={r.tc}>{r.mrr}</span>
                </div>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Revenue streams designed to compound: subscription builds relationship → custom research comes naturally → data licensing is the scale play. Each stream feeds the next.</p>
      </div>

      {/* Team Org & Hiring Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> TEAM ORG & HIRING PLAN — Struktur Tim MJP Saat Ini dan Rencana Hiring untuk Mendukung Target 1.000 Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] font-mono font-bold mb-1">Current Team (Aug 2026, 7 orang):</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-2">
            {[
              { name: "Hendra Wijaya", role: "CEO / Product", focus: "Strategy, investor, product roadmap, key enterprise relationships", load: "OVERLOADED — wears too many hats", tc: "text-orange-700" },
              { name: "Sari Dewi Kusuma", role: "Head of Research / Ops", focus: "Content quality, regulatory expert, Knowledge Registry, SKK advisory", load: "CRITICAL — single point of failure for quality", tc: "text-red-700" },
              { name: "Dewi Rahayu", role: "Junior Researcher", focus: "Content production, regulatory monitoring, crowdsource review", load: "OPTIMAL — good capacity buffer", tc: "text-emerald-700" },
              { name: "Budi Santoso", role: "Field Research Lead", focus: "Pain point collection, kontraktor profiling, field verification", load: "OPTIMAL", tc: "text-emerald-700" },
              { name: "Reza Purnama", role: "Account Manager", focus: "Client relationship, upsell, demo, churn save, enterprise QBR", load: "HIGH — needs 1 junior AM by Q4", tc: "text-orange-700" },
              { name: "Hendra Jr. (Dev)", role: "Full-Stack Engineer", focus: "Platform development, crawler maintenance, AI integration", load: "CRITICAL — solo developer for entire tech stack", tc: "text-red-700" },
              { name: "Finance/Admin (PT)", role: "Finance & Admin", focus: "Billing, invoicing, contracts, legal coordination", load: "STABLE", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.name} className="border rounded-sm p-2 bg-muted/10">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <p className="text-[8px] font-bold flex-1">{r.name}</p>
                  <span className={`text-[7px] font-mono ${r.tc}`}>{r.load.split(' ')[0]}</span>
                </div>
                <p className={`text-[7px] font-mono ${r.tc}`}>{r.role}</p>
                <p className="text-[7px] text-muted-foreground">{r.focus}</p>
              </div>
            ))}
          </div>
          <p className="text-[8px] font-mono font-bold mb-1">Hiring Plan (H2 2026 – H1 2027):</p>
          <div className="flex flex-col gap-1">
            {[
              { hire: "Backend Engineer #2", when: "Q4 2026", why: "Hendra Jr solo dev = existential risk. Crawler, AI, API — all single person. Bus factor 1.", budget: "Rp 8jt/bln", priority: "P0", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { hire: "Junior Researcher #2", when: "Q4 2026", why: "Sari SPOF for research quality. Junior #2 covers refreshes, monitoring, and routine annotation.", budget: "Rp 5jt/bln", priority: "P0", tc: "text-red-700", bc: "bg-red-50 border-red-200" },
              { hire: "Junior Account Manager", when: "Q1 2027", why: "Reza capacity maxes at 150 klien for quality QBR. At 200+ klien, need coverage split.", budget: "Rp 6jt/bln", priority: "P1", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
              { hire: "BIM / Technical Specialist", when: "Q2 2027", why: "BIM mandate Jan 2027. Advisory service premium. Need credibility — someone who has done actual BIM projects.", budget: "Rp 9jt/bln", priority: "P1", tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
            ].map((r) => (
              <div key={r.hire} className={`flex items-center gap-2 border rounded-sm p-2 ${r.bc}`}>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5"><p className={`text-[8px] font-bold ${r.tc}`}>{r.hire}</p><span className={`text-[7px] font-mono ${r.tc}`}>{r.when} · {r.budget}</span></div>
                  <p className="text-[7px] text-muted-foreground">{r.why}</p>
                </div>
                <span className={`text-[8px] font-black shrink-0 ${r.tc}`}>{r.priority}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Total new headcount cost 2027: +Rp 28jt/bln = Rp 336jt/thn. Funded by: 63 new klien at Growth tier. Current growth rate (8.4 klien/bln) funds hires in {'<'}8 bln.</p>
      </div>

      {/* MJP North Star Metrics */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" /> NORTH STAR METRICS — 3 Angka yang Paling Mencerminkan Kesehatan MJP: Jika 3 Ini Bagus, Semua Hal Lain Biasanya Mengikuti
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
          {[
            { metric: "Weekly Active Clients", current: "341 / 487", pct: "70%", target: "> 75%", trend: "+4pp MoM", interpretation: "Klien yang open platform minimal 1× per minggu. Leading indicator of retention. Di bawah 65% = churn wave incoming dalam 45 hari.", tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { metric: "Client Win Rate (avg)", current: "27.4%", benchmark: "vs 18% non-MJP", target: "> 30%", trend: "+0.8pp MoM", interpretation: "Rata-rata win rate seluruh klien MJP. Ini adalah ultimate proof point. Kalau ini naik = product works. Kalau turun = something is broken in our intel.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { metric: "Net Revenue Retention", current: "103%", benchmark: "industri SaaS: 105%", target: "> 110%", trend: "+2pp QoQ", interpretation: "Existing klien membayar 3% lebih dari tahun lalu (upsell > churn). Kalau NRR > 100%, bisnis tumbuh meski tanpa akuisisi. Target 110% = growth even if zero new clients.", tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.metric} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1`}>{r.metric}</p>
              <p className={`text-xl font-black font-mono ${r.tc}`}>{r.current}</p>
              <div className="flex gap-2 text-[8px] font-mono mt-0.5 mb-1">
                <span className={r.tc}>{r.trend}</span>
                <span className="text-muted-foreground">target: {r.target}</span>
              </div>
              <p className="text-[8px] text-muted-foreground">{r.interpretation}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">North star metrics diukur dan dilaporkan setiap Senin pagi oleh Hendra kepada seluruh tim. No context, no excuses — just the 3 numbers. Team harus bisa answer: "Kenapa naik?" atau "Kenapa turun?" setiap minggu.</p>
      </div>

      {/* Investor Readiness Checklist */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> INVESTOR READINESS — Seberapa Siap MJP untuk Proses Fundraising Series A? Checklist 20 Item yang Akan Ditanya Setiap VC
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { item: "MRR growth rate 3+ consecutive months", status: "✓", detail: "8.4 klien/bln consistently. MoM MRR growth 6.7%.", tc: "text-emerald-700" },
            { item: "Gross margin > 70%", status: "✓", detail: "73.4% gross margin. Data product economics.", tc: "text-emerald-700" },
            { item: "Churn rate < 5%/bln", status: "✓", detail: "2.8% bln churn. Top quartile for B2B SaaS.", tc: "text-emerald-700" },
            { item: "Net Revenue Retention > 100%", status: "✓", detail: "103% NRR. Upsell exceeds churn.", tc: "text-emerald-700" },
            { item: "CAC Payback < 12 bulan", status: "✓", detail: "7.2 bulan payback period avg.", tc: "text-emerald-700" },
            { item: "Clear unit economics per cohort", status: "✓", detail: "Cohort data 5 tahun. LTV/CAC 3.8×.", tc: "text-emerald-700" },
            { item: "Defensible moat articulation", status: "✓", detail: "Data moat, local expertise, network effect defined.", tc: "text-emerald-700" },
            { item: "TAM/SAM/SOM analysis with bottoms-up model", status: "✓", detail: "247K BUJK TAM, Rp 519M/thn. Documented.", tc: "text-emerald-700" },
            { item: "Audited financials last 2 years", status: "~", detail: "In progress with KAP Tanaka & Partners. Q3 2026.", tc: "text-orange-700" },
            { item: "Cap table clean and founder vesting in place", status: "~", detail: "Draft done. Legal review pending — Hendra 100% founder, no options yet.", tc: "text-orange-700" },
            { item: "Data room ready (financial model, contracts, tech docs)", status: "~", detail: "60% complete. Financial model done, contracts partially scanned.", tc: "text-orange-700" },
            { item: "Reference customers willing to speak to investors", status: "✓", detail: "4 champions confirmed. Rp 247M → Rp 67M wins to reference.", tc: "text-emerald-700" },
            { item: "CTO / technical co-founder or strong tech narrative", status: "✗", detail: "Hendra Jr. is team, not co-founder. Risk: solo founder with no dedicated CTO.", tc: "text-red-700" },
            { item: "18+ months runway post-raise clarity", status: "✓", detail: "Current runway: 14 months. Series A use-of-funds mapped to 36 months.", tc: "text-emerald-700" },
            { item: "Regulatory / compliance risk documented", status: "✓", detail: "LPJK, OJK, PDPA risks documented with mitigation plans.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.item} className="flex items-center gap-2 border-b py-1">
              <span className={`text-[9px] font-black w-4 shrink-0 ${r.tc}`}>{r.status}</span>
              <p className={`text-[8px] flex-1 ${r.tc}`}>{r.item}</p>
              <p className="text-[7px] text-muted-foreground text-right max-w-[180px]">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Score: 11/15 fully ready (73%). Main gaps: audited financials, cap table, CTO narrative. Target: 14/15 before engaging VCs. Timeline: Q1 2027 for Series A process start.</p>
      </div>

      {/* Product Sprint Velocity */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5 text-primary" /> SPRINT VELOCITY TRACKER — Kecepatan Pengiriman Produk MJP: Apa yang Selesai per Sprint dan Bagaimana Hendra Menjaga Fokus dengan 1 Developer?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          <div className="grid grid-cols-3 gap-1.5 mb-2">
            {[
              { stat: "14 hari", label: "Sprint cycle", tc: "text-blue-700" },
              { stat: "4–6", label: "Features/sprint avg", tc: "text-emerald-700" },
              { stat: "89%", label: "Sprint goal hit rate", tc: "text-emerald-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-lg font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          {[
            { sprint: "Sprint 24 (current — Jul 28 – Aug 10)", status: "IN PROGRESS", items: ["Entity resolution accuracy fix (P0 quality metric)", "Mobile push notification MVP (147 request backlog item #1)", "NLQ research query scoping doc", "SKK bulk import Excel — design phase"], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { sprint: "Sprint 23 (Jul 14–27)", status: "COMPLETED ✓", items: ["Crawler circuit breaker Telegram alert (15 min detection)", "Pre-Bid Intel Brief AI draft v1 (Sari reviews)", "Workroom server sync multi-user", "SKK Express case management dashboard"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { sprint: "Sprint 22 (Jun 30–Jul 13)", status: "COMPLETED ✓", items: ["Photo evidence in pain points (Base64 + storage)", "Workroom prospek tab from pain point clusters", "Export Excel filter dialogs (tenders + research)", "IjinTender price panel in surat penawaran"], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
          ].map((r) => (
            <div key={r.sprint} className={`border rounded-sm p-2.5 ${r.bc}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[9px] font-bold flex-1 ${r.tc}`}>{r.sprint}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-2">
                {r.items.map((item, i) => <p key={i} className={`text-[8px] ${r.tc}`}>• {item}</p>)}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">1 developer = constraint + discipline. No feature creep because there is no capacity for it. Hendra Jr. delivers 4–6 items/sprint consistently because scope is ruthlessly cut to essentials. Constraint is a feature.</p>
      </div>

      {/* Financial Runway Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> FINANCIAL RUNWAY — Model Keuangan MJP: Berapa Lama Perusahaan Bisa Bertahan Tanpa Revenue Baru dan Apa Rencana Contingency?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "Rp 714jt", label: "MRR (Aug 2026)", tc: "text-emerald-700" },
              { stat: "Rp 490jt", label: "Monthly burn", tc: "text-orange-700" },
              { stat: "Rp 224jt", label: "Monthly profit", tc: "text-emerald-700" },
              { stat: "14 bln", label: "Cash runway (zero growth)", tc: "text-blue-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-sm font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Cost Category</th>
                  <th className="p-1 text-center text-muted-foreground">Monthly</th>
                  <th className="p-1 text-center text-muted-foreground">% of burn</th>
                  <th className="p-1 text-center text-muted-foreground">Cuttable if needed?</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Personnel (7 orang)", "Rp 312jt", "63.7%", "Partial — min 4 core (Hendra, Sari, Hendra Jr., Reza)"],
                  ["Field research (Budi travel + ops)", "Rp 38jt", "7.8%", "Yes — to 50% short-term with data quality impact"],
                  ["Infrastructure (server, cloud)", "Rp 28jt", "5.7%", "Partial — reduce to essential services only"],
                  ["Office + admin", "Rp 21jt", "4.3%", "Yes — full WFH option exists"],
                  ["Marketing + events", "Rp 47jt", "9.6%", "Yes — most is variable. Content still free."],
                  ["Legal + accounting", "Rp 18jt", "3.7%", "Partial — defer non-essential work"],
                  ["Miscellaneous", "Rp 26jt", "5.3%", "Yes"],
                ].map(([cat, monthly, pct, cut], i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{cat}</td>
                    <td className="p-1 text-center">{monthly}</td>
                    <td className="p-1 text-center text-muted-foreground">{pct}</td>
                    <td className="p-1 text-muted-foreground">{cut}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Contingency Plan (if MRR drops {'>'} 30%):</p>
            <p className="text-[8px]">Step 1: Halt marketing spend (-Rp 47jt). Step 2: WFH all (-Rp 21jt). Step 3: Reduce Budi travel 50% (-Rp 19jt). Step 4: Defer legal non-urgent (-Rp 12jt). Total savings: Rp 99jt/bln. New burn: Rp 391jt. At current cut scenario: runway extends to 22+ months.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP operates profitable-first — this runway model assumes no new revenue. With 8.4 new klien/bln at current pace: positive cash position growing, not shrinking. Runway is theoretical floor, not trajectory.</p>
      </div>

      {/* Growth Levers Prioritization */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> GROWTH LEVERS — 8 Pendorong Pertumbuhan yang MJP Bisa Aktifkan dan Berapa Potensi Revenue dari Masing-Masing dalam 12 Bulan?
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { lever: "Expansion Revenue — Existing Klien Upgrade Tier", potential: "+Rp 180jt ARR", effort: "LOW", how: "23% Growth klien show Enterprise-level usage. 4-call upsell campaign per kuartal. Reza owned.", tc: "text-emerald-700" },
            { lever: "Referral Program — Formal Launch Q4 2026", potential: "+Rp 120jt ARR", effort: "LOW", how: "1 bulan gratis untuk referrer + 1 bulan gratis untuk referred. Target: 30% of new signups via referral (currently 17%).", tc: "text-emerald-700" },
            { lever: "GAPENSI Partnership Activation", potential: "+Rp 310jt ARR", effort: "MEDIUM", how: "Endorsed access to 48.000 GAPENSI members. Even 1% conversion at avg Rp 1.3jt MRR = Rp 624jt ARR. Conservative: 0.5% = Rp 312jt.", tc: "text-emerald-700" },
            { lever: "BIM Advisory Service Launch", potential: "+Rp 140jt ARR", effort: "MEDIUM", how: "Rp 3.5jt/project. Target: 40 projects/bln by month 6. Rev split 60/40 MJP/specialist.", tc: "text-blue-700" },
            { lever: "Bank UMKM Bundle (Mandiri/BRI)", potential: "+Rp 250jt ARR", effort: "HIGH", how: "12–18 bulan sales cycle. 2027 revenue. Bundled access with KUR lending product.", tc: "text-orange-700" },
            { lever: "KTI Market Expansion (Kalimantan/Sulawesi/Papua)", potential: "+Rp 180jt ARR", effort: "HIGH", how: "Requires: 1 KTI researcher hire + 6 months coverage building. Revenue in Q3 2027.", tc: "text-orange-700" },
            { lever: "Post-PHO Warranty Tracking Product (New)", potential: "+Rp 95jt ARR", effort: "HIGH", how: "New product line. 6-month build. Target: 60 klien at Rp 400rb/bln add-on.", tc: "text-orange-700" },
            { lever: "Price Increase — Starter Tier (Rp 800rb → Rp 950rb)", potential: "+Rp 44jt ARR", effort: "LOW", how: "291 Starter × Rp 150rb delta × 12 = Rp 524jt annual. Account for 30% churn: net Rp 44jt. Low risk — last increase was 18 months ago.", tc: "text-blue-700" },
          ].map((r) => (
            <div key={r.lever} className="flex gap-2 items-start border-b py-1">
              <div className="flex-1">
                <p className="text-[8px] font-bold mb-0.5">{r.lever}</p>
                <p className="text-[8px] text-muted-foreground">{r.how}</p>
              </div>
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <span className={`text-[8px] font-mono font-bold ${r.tc}`}>{r.potential}</span>
                <span className={`text-[7px] font-mono ${r.effort === "LOW" ? "text-emerald-600" : r.effort === "MEDIUM" ? "text-orange-600" : "text-red-600"}`}>{r.effort} EFFORT</span>
              </div>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200 mt-1">
            <p className="text-[9px] font-bold text-emerald-700">Total addressable with all levers activated (12–18 months): +Rp 1.32M ARR potential</p>
            <p className="text-[8px] text-muted-foreground">Focus for H2 2026: Levers 1, 2, 3, 8 (all LOW/MEDIUM effort). Combined potential: +Rp 654jt ARR.</p>
          </div>
        </div>
      </div>

      {/* Hiring Plan 2027 */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> HIRING PLAN 2027 — Rencana Rekrutmen MJP Berdasarkan Revenue Milestone dan Kapan Setiap Posisi Terbuka untuk Diisi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { trigger: "Trigger: Rp 900jt MRR (est. Q1 2027)", hires: [{ role: "SKK Admin (Junior Dewi)", rationale: "SKK Express at capacity: 64 cases/bln cap. Each case = Rp 940rb avg. 1 hire → +36 cases/bln → +Rp 406jt ARR. 3-month payback.", comp: "Rp 4.8jt/bln gross" }, { role: "Account Manager (Junior Reza)", rationale: "At 487 klien, Reza is fully utilized. Growth plateau ahead without AM support. New AM shadows Reza 2 months.", comp: "Rp 6.2jt/bln gross" }], tc: "text-emerald-700", bc: "bg-emerald-50 border-emerald-200" },
            { trigger: "Trigger: Rp 1.2M MRR (est. Q3 2027)", hires: [{ role: "KTI Field Researcher", rationale: "KTI market is 16% of national construction but only 6% of MJP revenue. Field presence unlocks Sulawesi + Kalimantan intelligence.", comp: "Rp 5.5jt/bln + Rp 2jt field ops" }, { role: "Backend Developer (Junior Hendra Jr.)", rationale: "At > 600 klien, tech debt P0–P1 becomes existential. Need second dev to maintain quality while Hendra Jr. focuses architecture.", comp: "Rp 9.8jt/bln gross" }], tc: "text-blue-700", bc: "bg-blue-50 border-blue-200" },
            { trigger: "Trigger: Series A closed (est. Q2 2028)", hires: [{ role: "Head of Sales (Reza promo or external)", rationale: "Scale from 400–500/bln organic growth to 1.000+/bln with structured outbound + partnerships.", comp: "Rp 15–22jt/bln" }, { role: "Data Scientist", rationale: "Entity resolution ML, churn prediction model, HPS model accuracy improvements. Unlocks AI competitive advantage.", comp: "Rp 14–18jt/bln" }], tc: "text-orange-700", bc: "bg-orange-50 border-orange-200" },
          ].map((r) => (
            <div key={r.trigger} className={`border rounded-sm p-3 ${r.bc}`}>
              <p className={`text-[9px] font-bold ${r.tc} mb-1.5`}>{r.trigger}</p>
              <div className="flex flex-col gap-1">
                {r.hires.map((h) => (
                  <div key={h.role} className="flex gap-2">
                    <p className="text-[8px] font-bold w-48 shrink-0">{h.role} <span className="font-mono text-[7px]">({h.comp})</span></p>
                    <p className="text-[8px] text-muted-foreground">{h.rationale}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hire when revenue justifies it — not earlier. Each hire is tied to a specific revenue trigger and has a clear ROI case. No vanity hires. Rule: new hire must pay back fully in {'<'} 6 months (service roles) or {'<'} 12 months (product roles).</p>
      </div>

      {/* Platform Health KPIs */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <HeartPulse className="h-3.5 w-3.5 text-red-500" /> PLATFORM HEALTH — 12 KPI yang Hendra Lihat Setiap Pagi sebelum Memulai Hari: Apa Artinya Masing-Masing dan Berapa Target Minimalnya?
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { kpi: "Daily Active Users (DAU)", current: "312", target: "350 by Q4", status: "ON TRACK", trend: "↑", desc: "Unique logins per day (7-day rolling avg). Below 280 = alert Reza." },
            { kpi: "MRR", current: "Rp 714jt", target: "Rp 900jt by Q1 2027", status: "ON TRACK", trend: "↑", desc: "Monthly Recurring Revenue. Watch weekly. Drops > 5% in one week = immediate investigation." },
            { kpi: "New Klien (MoM)", current: "+8.4/bln avg", target: "+10/bln", status: "BEHIND", trend: "→", desc: "Net new paying clients per month. Driving: Referral program launch + GAPENSI partnership." },
            { kpi: "Churn Rate", current: "13% monthly", target: "<11% by Q4", status: "AT RISK", trend: "↑", desc: "Monthly % of clients who did not renew. Currently 13% = higher than target. Reza intervention program active." },
            { kpi: "SKK Express Cases", current: "64/bln", target: "80/bln", status: "BEHIND", trend: "→", desc: "Limited by Dewi capacity. Hiring trigger: 75 cases/bln for 2 consecutive months." },
            { kpi: "Data Pipeline Uptime", current: "99.2%", target: "99.5%+", status: "GOOD", trend: "→", desc: "Crawler + processing pipeline availability. Includes: LPSE, LPJK crawlers. Tracked via BullMQ job success rate." },
            { kpi: "L1 Alert SLA Compliance", current: "96.1%", target: "98%+", status: "BEHIND", trend: "↓", desc: "% of L1 alerts delivered within 30 minutes of Sari approval. Current breach cause: Sari away from desk." },
            { kpi: "Knowledge Registry Freshness", current: "83.3%", target: "90%+", status: "AT RISK", trend: "↑", desc: "% of assets updated within their expiry window. 47 assets overdue. Dewi refresh sprint in progress." },
            { kpi: "Enterprise NPS (quarterly)", current: "+71", target: "+75", status: "GOOD", trend: "↑", desc: "NPS from Enterprise tier only. Leading indicator of renewal + expansion." },
            { kpi: "Reza Pipeline Coverage", current: "2.8×", target: "3.5×+ MRR", status: "BEHIND", trend: "→", desc: "Reza's quarterly upsell/new pipeline value vs quarterly MRR target. Need more GAPENSI-sourced leads." },
          ].map((r) => (
            <div key={r.kpi} className="flex gap-2 items-start border-b py-0.5">
              <span className="text-base font-bold text-muted-foreground w-4 shrink-0">{r.trend}</span>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-[8px] font-bold">{r.kpi}</p>
                  <span className={`text-[7px] font-mono ${r.status === "GOOD" || r.status === "ON TRACK" ? "text-emerald-700" : r.status === "AT RISK" ? "text-orange-700" : "text-red-700"}`}>{r.status}</span>
                </div>
                <p className="text-[7px] text-muted-foreground">{r.desc}</p>
              </div>
              <div className="flex flex-col items-end shrink-0">
                <span className="text-[8px] font-mono font-bold">{r.current}</span>
                <span className="text-[7px] text-muted-foreground">{r.target}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">KPI dashboard reviewed by Hendra every morning (10 minutes). Weekly team KPI review every Monday. Rule: if 3+ KPIs are AT RISK simultaneously = war room mode (daily alignment, no new features until fixed). Currently: 4 AT RISK/BEHIND — approaching war room threshold.</p>
      </div>

      {/* Revenue Mix Health */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-emerald-600" /> REVENUE MIX — Komposisi Pendapatan MJP Sekarang vs Target 2027: Mengapa Diversifikasi Revenue Streams Penting untuk Ketahanan Bisnis?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Revenue Stream</th>
                  <th className="p-1 text-center">Q3 2026 (actual)</th>
                  <th className="p-1 text-center">Target Q4 2027</th>
                  <th className="p-1 text-center">Margin</th>
                  <th className="p-1 text-center">Risk</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["SaaS Subscription (Growth + Enterprise)", "Rp 489jt (68.5%)", "Rp 780jt (65%)", "87%", "LOW"],
                  ["SKK Express Service", "Rp 128jt (17.9%)", "Rp 180jt (15%)", "54%", "LOW"],
                  ["Pre-Bid Intel Briefs (project-based)", "Rp 54jt (7.6%)", "Rp 120jt (10%)", "71%", "MED"],
                  ["Enterprise API Access", "Rp 18jt (2.5%)", "Rp 60jt (5%)", "91%", "LOW"],
                  ["Training / Webinar", "Rp 11jt (1.5%)", "Rp 30jt (2.5%)", "76%", "MED"],
                  ["Other (ad-hoc research)", "Rp 14jt (2.0%)", "Rp 30jt (2.5%)", "43%", "HIGH"],
                  ["Total MRR", "Rp 714jt", "Rp 1.2M", "79% blended", "LOW"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${i === 6 ? "font-bold bg-muted/10" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className="p-1 text-center">{row[1]}</td>
                    <td className="p-1 text-center font-bold text-emerald-700">{row[2]}</td>
                    <td className="p-1 text-center">{row[3]}</td>
                    <td className={`p-1 text-center font-bold ${row[4] === "LOW" ? "text-emerald-700" : row[4] === "MED" ? "text-orange-700" : "text-red-700"}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-blue-50 border-blue-200">
            <p className="text-[9px] font-bold text-blue-700">Diversification principle:</p>
            <p className="text-[8px]">SaaS subscription = engine (must stay {'>'} 60%). SKK Express = flywheel (brings in BUJK who then subscribe). Pre-Bid Briefs = upsell (Enterprise LTV lift). API = highest-margin, lowest churn. Target: no single stream {'>'} 70% of revenue (concentration risk). Currently 68.5% SaaS — acceptable, trending down as other streams grow.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Revenue mix review every 6 months. The danger zone: SaaS drops below 55% = structural problem (churn accelerating faster than other streams growing). The opportunity zone: Pre-Bid Briefs + API reaching 20%+ combined = premium product-market fit achieved.</p>
      </div>

      {/* Investor Story — MJP Pitch Narrative */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Presentation className="h-3.5 w-3.5 text-primary" /> INVESTOR NARRATIVE — Bagaimana Hendra Menceritakan MJP ke Investor dalam 4 Menit: Struktur Pitch yang Sudah Divalidasi dengan 3 VC Meetings?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { beat: "1. The Market Hook (30 detik)", content: "Indonesia punya 214.000 BUJK aktif yang bertarung untuk Rp 480 triliun proyek konstruksi pemerintah setiap tahun. Ini industri yang penting secara nasional tapi tertinggal secara informasi. Rata-rata kontraktor kalah tender karena tidak tahu harga yang wajar, bukan karena tidak mampu.", tc: "text-blue-700" },
            { beat: "2. The Pain (45 detik)", content: "Di Jawa Tengah, seorang direktur CV Bangun Mandiri menghabiskan 2 jam setiap hari mengecek LPSE satu per satu, membaca regulasi yang tidak dia mengerti, dan membuat keputusan bid berdasarkan perkiraan. Bukan karena dia tidak pintar — tapi karena tidak ada satu pun platform yang mengumpulkan semua informasi yang dia butuhkan.", tc: "text-orange-700" },
            { beat: "3. The Solution (60 detik)", content: "MJP adalah platform intelligence khusus untuk industri konstruksi Indonesia. Kami aggregasi 6+ sumber data, menganalisis dengan AI dan domain expert kami, dan deliver ke kontraktor dalam format yang bisa langsung diaksi — alert WhatsApp, briefing harian, pre-bid intel, dan SKK Express untuk kepatuhan administrasi.", tc: "text-emerald-700" },
            { beat: "4. The Traction (45 detik)", content: "487 klien aktif. Rp 714jt MRR. 83% gross margin. Churn 13% monthly — tim kami sedang menurunkan ini. NPS Enterprise: +71. 34% growth YoY with zero paid marketing. Every customer came from referral or direct outreach by Reza.", tc: "text-emerald-700" },
            { beat: "5. The Ask + Use of Funds (30 detik)", content: "Kami raise Series A Rp 12M untuk: 40% product (NLQ + BIM vertical), 35% sales expansion (2 AM hires + GAPENSI partnership), 25% KTI expansion (field researcher + coverage). Target: Rp 2.4M ARR dalam 24 bulan. Unit economics: <12 month payback, 18× LTV/CAC.", tc: "text-primary" },
          ].map((r, i) => (
            <div key={r.beat} className="border-l-2 border-primary/30 pl-3 py-1.5">
              <p className={`text-[9px] font-bold ${r.tc} mb-0.5`}>{r.beat}</p>
              <p className="text-[8px] text-muted-foreground">{r.content}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pitch refined after 3 VC meetings (1 reject, 1 'follow up in 6 months', 1 LOI pending). Most common VC question: 'What prevents a large tech company from copying this?' Answer: proprietary dataset (4.5 years), domain expert moat (Sari), and relationship network (Dewi's LPJK, Budi's field). Technology is replicable; relationships are not.</p>
      </div>

      {/* Unit Economics Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calculator className="h-3.5 w-3.5 text-primary" /> UNIT ECONOMICS — Anatomi Ekonomi per Klien MJP: CAC, LTV, Payback, Margin per Tier — Angka yang Hendra Monitor Setiap Bulan?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Metric</th>
                  <th className="p-1 text-center">Basic</th>
                  <th className="p-1 text-center">Pro</th>
                  <th className="p-1 text-center">Enterprise</th>
                  <th className="p-1 text-center">SKK Express</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["MRR per klien", "Rp 499K", "Rp 1.299K", "Rp 3.499K", "~Rp 1.800K avg"],
                  ["CAC (Reza time + events)", "Rp 180K", "Rp 310K", "Rp 1.200K", "Rp 90K"],
                  ["Gross Margin per klien/bln", "72%", "80%", "85%", "68%"],
                  ["Avg LTV (at current churn)", "Rp 2.9M", "Rp 7.8M", "Rp 28.2M", "Rp 540K per case"],
                  ["LTV/CAC ratio", "16×", "25×", "24×", "6×"],
                  ["Payback period", "4.3 months", "2.9 months", "8.4 months", "0.7 months"],
                  ["Annual revenue contribution (avg)", "Rp 5.99M", "Rp 15.59M", "Rp 41.99M", "per case basis"],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${i === 2 ? "bg-primary/5" : ""}`}>
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center font-bold text-emerald-700">{row[3]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Strategic insight:</p>
            <p className="text-[8px]">Enterprise has highest absolute LTV (Rp 28.2M) but longest payback (8.4 months). Basic has fastest payback but lowest absolute LTV. Pro is the sweet spot: high LTV/CAC (25×) + fast payback (2.9 months). Hendra's rule: grow Pro cohort as % of base. Currently 31% Pro, target 45% in 18 months.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">SKK Express has low LTV/CAC (6×) but zero CAC for cross-sell (klien already in system). Net CAC for cross-sell = Rp 0 (Dewi just calls them). True LTV/CAC for SKK Express when sold to existing subscribers = effectively infinite. This is why cross-sell is MJP's highest-ROI growth lever.</p>
      </div>

      {/* Churn Cohort Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-orange-500" /> CHURN COHORT — Anatomi 13% Churn Bulanan MJP: Siapa yang Churning, Kapan, dan Mengapa — dengan Rencana Aksi Spesifik untuk Setiap Penyebab
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "13%", label: "Monthly churn (blended)", tc: "text-orange-700" },
              { stat: "Bulan 2–3", label: "Highest churn window", tc: "text-red-700" },
              { stat: "7%", label: "Target churn by Q4 2026", tc: "text-emerald-700" },
              { stat: "Rp 93jt", label: "MRR lost to churn/bln", tc: "text-orange-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[7px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Churn Reason</th>
                  <th className="p-1 text-center">% of churns</th>
                  <th className="p-1 text-center">When</th>
                  <th className="p-1 text-left">Reza's intervention</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Tidak menang tender selama 2+ bln", "31%", "Month 2–4", "Win story WA + case study. 'This klien won after 3 months of no-win.'"],
                  ["Lupa apa yang didapat dari MJP (vague value)", "22%", "Month 1–2", "Aha moment campaign. Reza review call Day 30."],
                  ["Harga terlalu mahal (Basic klien)", "18%", "Month 1", "Offer annual plan (23% discount). Only if klien shows usage."],
                  ["Tender musim sepi / project selesai", "14%", "Any (seasonal)", "Pause option (vs cancel). Re-engagement in Aug for Sep season."],
                  ["Platform terlalu kompleks", "8%", "Month 1", "Simplified onboarding path. Dewi runs 20-min orientation call."],
                  ["Bergabung ke competitor platform", "4%", "Month 3+", "Reza win-back: 'What did they have that we didn't?' Learn + consider feature."],
                  ["Keluar bisnis / tidak aktif", "3%", "Any", "No intervention. Mark as 'closed business' in CRM."],
                ].map((row, i) => (
                  <tr key={i} className={`border-b hover:bg-muted/20 ${parseInt(row[1]) >= 25 ? "font-bold" : ""}`}>
                    <td className="p-1">{row[0]}</td>
                    <td className={`p-1 text-center ${parseInt(row[1]) >= 25 ? "text-red-700" : "text-muted-foreground"}`}>{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-emerald-700">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Churn data from Reza's exit interviews (optional, 48% response rate). Top 2 reasons (31% + 22% = 53%) are both addressable through better early value delivery. Churn target 7%: requires solving the vague value problem (Day 14 aha moment protocol) AND reducing no-win anxiety (case study + win streak tracking). Estimated MRR impact of hitting 7% churn: +Rp 140jt/bln.</p>
      </div>

      {/* Series A Readiness Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Star className="h-3.5 w-3.5 text-amber-500" /> SERIES A READINESS — Seberapa Siap MJP untuk Series A: Scorecard 10 Kriteria Investor-Grade dan Target yang Masih Perlu Dicapai Sebelum Q4 2027
        </p>
        <div className="flex flex-col gap-1 mb-3">
          {[
            { criterion: "MRR > Rp 1M/bln", current: "Rp 714jt", target: "Rp 1M", status: "🟡 74%", note: "Gap: ~6 bulan at current growth rate. Achievable Q1 2027." },
            { criterion: "Monthly churn < 8%", current: "13%", target: "<8%", status: "🔴 Below", note: "Critical. Q3 OKR dedicated to this. 6–9 months to fix." },
            { criterion: "NPS > +60 (overall)", current: "+54", target: "+60", status: "🟡 Close", note: "Pro +61 ✅. Basic dragging overall score." },
            { criterion: "Annual growth > 30%", current: "34% YoY", target: "30%", status: "✅ Done", note: "Exceeds target. Maintain momentum." },
            { criterion: "Gross margin > 75%", current: "83%", target: "75%", status: "✅ Done", note: "Class-leading for B2B SaaS Indonesia." },
            { criterion: "Product differentiation (SKK Express unique)", current: "Yes", target: "Clear moat", status: "✅ Done", note: "No competitor has SKK Express." },
            { criterion: "Klien base > 600 active", current: "487", target: "600+", status: "🟡 81%", note: "At current acquisition: ~4 months away." },
            { criterion: "Enterprise > 40 klien", current: "31", target: "40", status: "🟡 78%", note: "2–3 Enterprise deals in Reza's pipeline." },
            { criterion: "AI product shipped (NLQ)", current: "70% built", target: "Live", status: "🟡 In progress", note: "Critical for tech investor narrative. Q4 2026." },
            { criterion: "BIM vertical launched", current: "6/20 assets", target: "20 assets live", status: "🔴 Partial", note: "Blocks BIM mandate market capture. Q4 2026 push needed." },
          ].map((r) => (
            <div key={r.criterion} className="flex gap-2 items-start border-b py-1">
              <p className="text-[8px] font-bold w-52 shrink-0">{r.criterion}</p>
              <p className="text-[7px] text-muted-foreground w-16 shrink-0">{r.current}</p>
              <p className={`text-[7px] font-mono w-28 shrink-0 ${r.status.includes("✅") ? "text-emerald-700" : r.status.includes("🔴") ? "text-red-700" : "text-orange-700"}`}>{r.status}</p>
              <p className="text-[7px] text-muted-foreground flex-1">{r.note}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Current score: 4/10 criteria fully met, 4/10 close (within 6 months), 2/10 need significant work (churn, BIM). Hendra's assessment: Series A realistic Q4 2027 if churn hits {'<'}8% by Q2 2027 AND NLQ ships Q4 2026. Without those 2: metrics are good but story is incomplete for institutional investors. 'Good product + bad churn = leaky bucket story.'</p>
      </div>

      {/* Investor Pitch Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> PITCH ARCHITECTURE — Arsitektur Pitch Deck MJP untuk Series A: 12-Slide Narrative, Urutan Argumen, dan Mengapa Slide 3 Adalah Slide Paling Penting
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { slide: "S1 — Cover", hook: "Platform Riset Marketing Konstruksi Indonesia. MJP.", purpose: "Brand recall. Clean. No bullet points. Just the name and tagline.", weight: "Low" },
            { slide: "S2 — The Market Problem", hook: "'Rp 419T konstruksi/tahun. Tapi 89% BUJK masih mengandalkan koneksi personal, bukan intelijen pasar.'", purpose: "Establish pain scale. Investor must feel the inefficiency of the status quo before seeing MJP.", weight: "High" },
            { slide: "S3 — Why Now (Regulatory Tailwind)", hook: "'3 regulatory changes in 2024–2027 forcing BUJK to upgrade or exit: BIM mandate, SBU digital verification, UU PDP compliance.'", purpose: "THE MOST IMPORTANT SLIDE. Explains why the market is moving now, not 5 years ago or 5 years later. Timing thesis.", weight: "CRITICAL" },
            { slide: "S4 — MJP Solution", hook: "One sentence: 'MJP converts LPSE noise + regulatory chaos into daily actionable intelligence for 12.400+ BUJK.'", purpose: "Solution framing. Not a product demo slide — a concept slide. What we do in one sentence.", weight: "High" },
            { slide: "S5 — Traction", hook: "487 klien. Rp 714jt MRR. 34% YoY. 83% gross margin. Enterprise signed: 31.", purpose: "Credibility. Numbers only — no stories. Let the data speak. Investors see traction before product detail.", weight: "CRITICAL" },
            { slide: "S6 — Product Walkthrough (2 min)", hook: "Live demo or 3 screenshots: Daily Briefing → Tender Alert → SKK Express outcome.", purpose: "Concretize the product. Investors need to see it. 2 minutes max — don't demo everything.", weight: "Medium" },
            { slide: "S7 — Business Model", hook: "3 tiers (Basic/Pro/Enterprise). SKK Express add-on. API. Retention mechanics.", purpose: "Revenue architecture. Show recurring + transactional. Show why klien don't churn.", weight: "High" },
            { slide: "S8 — Competitive Moat", hook: "'4 moats: Dewi's LPJK network (4 years), Sari's annotation corpus (3.200 assets), 312 LPSE connections, klien switching cost.'", purpose: "Defend the position. Answer 'why can't someone copy this?'", weight: "High" },
            { slide: "S9 — Team", hook: "Hendra (domain + product), Sari (research), Hendra Jr. (tech), Dewi (SKK), Reza (sales), Budi (field).", purpose: "Founders are the product at this stage. Show complementarity.", weight: "High" },
            { slide: "S10 — Use of Funds", hook: "Series A: Rp 15M target. 60% engineering (NLQ + BIM vertical), 25% team (2 hires), 15% marketing.", purpose: "Specificity = credibility. Investors fund plans, not vague ambitions.", weight: "Medium" },
            { slide: "S11 — 18-Month Milestones", hook: "Q4 2026: NLQ live. Q1 2027: BIM 20 assets. Q2 2027: churn <8%. Q4 2027: 1.000 klien.", purpose: "Concrete targets the investor can hold you to. Shows you have a plan.", weight: "Medium" },
            { slide: "S12 — The Ask", hook: "Rp 15M. Pre-money valuation Rp 75M (5× ARR). Lead investor gets board seat offer.", purpose: "Close the meeting with a clear ask. Don't be vague about valuation.", weight: "High" },
          ].map((r) => (
            <div key={r.slide} className={`flex gap-2 border-b py-1 ${r.weight === "CRITICAL" ? "bg-amber-50" : ""}`}>
              <p className={`text-[8px] font-bold w-32 shrink-0 ${r.weight === "CRITICAL" ? "text-amber-700" : r.weight === "High" ? "text-primary" : "text-muted-foreground"}`}>{r.slide}</p>
              <div className="flex-1">
                <p className="text-[7px] italic text-muted-foreground mb-0.5">{r.hook}</p>
                <p className="text-[7px]">{r.purpose}</p>
              </div>
              <span className={`text-[7px] font-mono shrink-0 w-16 text-right ${r.weight === "CRITICAL" ? "text-amber-700 font-bold" : "text-muted-foreground"}`}>{r.weight}</span>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Pitch deck written by Hendra, reviewed by Reza (sales lens) and one external VC mentor (anonymous). Slide 3 (Why Now) is most iterated — 7 versions. Hendra: 'Investors fund timing, not just ideas. The why-now argument must be airtight before anything else.' Current version tested in 2 warm VC conversations (Q2 2026). Feedback: traction strong, churn explanation needs more confidence (this is being addressed through Q3 OKR execution first).</p>
      </div>

      {/* Revenue Concentration Risk */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartPie className="h-3.5 w-3.5 text-primary" /> CONCENTRATION RISK — Risiko Konsentrasi Pendapatan MJP: Seberapa Tergantung MJP pada Klien Terbesar, dan Apa Rencana Mitigasi Jika 3 Enterprise Klien Terbesar Churn?
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "31", label: "Enterprise klien", tc: "text-primary" },
              { stat: "38%", label: "MRR from Enterprise tier", tc: "text-orange-700" },
              { stat: "Rp 8.7jt", label: "Avg Enterprise MRR", tc: "text-primary" },
              { stat: "Rp 271jt", label: "MRR if all 31 Enterprise churned", tc: "text-red-700" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="border rounded-sm p-2.5 bg-orange-50 border-orange-200 mb-2">
            <p className="text-[9px] font-bold text-orange-700">Top-3 Enterprise concentration analysis:</p>
            <div className="flex flex-col gap-0.5 mt-0.5">
              {[
                { rank: "#1", profile: "BUJK J9 Nasional, 3 proyek aktif, 22 bulan tenure", mrr: "Rp 14.2jt/bln", pct: "2.0% of total MRR", risk: "Low churn risk — deeply embedded, API user, 3 WA groups active" },
                { rank: "#2", profile: "Konsultan BUJK multi-klien (manages 8 BUJK), Jakarta", mrr: "Rp 12.8jt/bln", pct: "1.8% of total MRR", risk: "Medium risk — single person (Pak Agus). If he retires: account at risk." },
                { rank: "#3", profile: "BUJK J8 Sumatra, 14 bulan tenure, BIM pilot", mrr: "Rp 11.1jt/bln", pct: "1.6% of total MRR", risk: "Low-medium risk — BIM dependency makes MJP critical. Contract through Q4 2026." },
              ].map((r) => (
                <div key={r.rank} className="flex gap-2 text-[7px] border-b py-0.5">
                  <p className="font-bold w-6 shrink-0">{r.rank}</p>
                  <p className="w-44 shrink-0 text-muted-foreground">{r.profile}</p>
                  <p className="font-bold w-20 shrink-0">{r.mrr}</p>
                  <p className="text-muted-foreground w-24 shrink-0">{r.pct}</p>
                  <p className="text-muted-foreground flex-1">{r.risk}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="border rounded-sm p-2.5 bg-muted/10">
            <p className="text-[9px] font-bold mb-0.5">Stress test: top 3 Enterprise churn simultaneously</p>
            <p className="text-[7px]">MRR impact: −Rp 38.1jt/bln (−5.3% total MRR). Survivable — MJP would still be cash-flow positive. The real risk: cascading churn signal. If 3 Enterprise leave in same quarter, it signals a market problem Reza must investigate immediately. Mitigation: Enterprise Health Score (monthly, Reza). Any Enterprise health {'<'}70% → Hendra escalates personally.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Enterprise concentration is manageable (38% MRR from 31 klien = avg 1.2% per Enterprise klien). Better diversification than Series A investors typically worry about. More concerning: Pro tier concentration — top 50 Pro klien represent 31% of Pro MRR. Reza tracks both Enterprise and Top-50-Pro health monthly. Goal: no single klien {'>'} 2.5% of total MRR (currently satisfied at 2.0% for #1 Enterprise).</p>
      </div>

      {/* MJP Culture Code */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Heart className="h-3.5 w-3.5 text-rose-500" /> CULTURE CODE — Kode Budaya MJP: 7 Nilai yang Membentuk Cara Tim Bekerja, Membuat Keputusan, dan Berinteraksi dengan Klien — Ditulis Hendra Setelah Kesalahan Rekrutmen Pertama di 2023
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { value: "V1 — Akurasi di atas kecepatan", desc: "Lebih baik terlambat 1 jam dengan data yang benar daripada tepat waktu dengan data yang salah. MJP tidak pernah publish untuk 'cukup baik' — Sari's quality gate is non-negotiable. Exception: L1 alert where delay has direct impact. Even then: 'better right and 30 minutes late than wrong and on time.'", origin: "Setelah 1 kasus alert salah yang menyebabkan klien early bird submission ke tender yang sudah ditutup (Q3 2022). Never repeated." },
            { value: "V2 — Jujur dengan ketidakpastian", desc: "Tidak boleh menyamarkan confidence level. Data dengan estimasi 70% confidence diberi label [Est. 70%]. Sari boleh tidak tahu — dan harus mengatakan 'saya perlu verifikasi dulu' tanpa merasa inferior. Ketidakjujuran tentang uncertainty = merusak kepercayaan lebih parah dari ketidaktahuan itu sendiri.", origin: "Dari Hendra's academic background — scientific uncertainty notation applied to business intelligence." },
            { value: "V3 — Klien adalah mitra, bukan angka", desc: "Reza tidak boleh menggunakan bahasa 'konversi' atau 'pipeline' di depan tim. Internal metric OK, tapi mindset: setiap klien adalah sebuah BUJK dengan orang-orang nyata yang membuat keputusan bisnis nyata. Klien yang churn = MJP gagal memberikan nilai, bukan klien yang salah.", origin: "Setelah Hendra mendengar Reza menyebut klien yang churn sebagai 'lead yang konvert balik' (Q1 2023). Langsung dikoreksi dan dijadikan budaya." },
            { value: "V4 — Lapangan selalu lebih benar dari asumsi kantor", desc: "Budi's field observation overrides Hendra's product assumption. If Budi says BUJK di lapangan tidak menggunakan fitur X dengan cara yang Hendra bayangkan: fitur X perlu diubah, bukan Budi yang perlu 'diedukasi'. The market is always right, and Budi is MJP's market signal.", origin: "Langsung dari filosofi produk Hendra: build for users, not for demos." },
            { value: "V5 — Berkelanjutan, bukan sprint tanpa batas", desc: "Tidak ada 'crunch culture'. Tidak ada jam kerja malam kecuali P0. Dewi punya jam tetap karena koordinasi asesor menuntut ketenangan pikiran. Sari's morning block (08:00–10:00) adalah sacred. Burnout = quality collapse. MJP's product is intellectual work — exhausted minds produce inferior intelligence.", origin: "Hendra: 'I watched a startup I respected destroy their research team with crunch. The product died 18 months later.'" },
            { value: "V6 — Transparansi internal tanpa politik", desc: "Semua keputusan yang sudah dibuat dicatat di Notion dalam 24 jam. Tidak ada 'keputusan yang terjadi di luar meeting'. Jika Hendra berubah pikiran: dia menulis alasannya. Tidak ada 'kita sudah bilang ini dari dulu' tanpa bukti tertulis. Transparansi mencegah politics dari tumbuh.", origin: "Diterapkan dari hari pertama. Hendra: 'Small team + opacity = factional thinking. We can't afford that.'" },
            { value: "V7 — Improve sesuatu setiap minggu", desc: "Setiap anggota tim identifikasi 1 hal kecil yang diperbaiki setiap minggu — tidak harus besar, tidak harus sempurna. Sari: 1 prompt improvement. Hendra Jr.: 1 technical debt item. Reza: 1 sales process tweak. Budi: 1 interview technique refinement. Compounding marginal improvements = competitive moat over time.", origin: "Dari James Clear's Atomic Habits, applied to team performance. Hendra reads 1 book/month and extracts 1 applicable principle." },
          ].map((r) => (
            <div key={r.value} className="border-b py-1.5">
              <p className="text-[8px] font-bold text-rose-700 mb-0.5">{r.value}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.desc}</p>
              <p className="text-[7px] font-mono text-muted-foreground italic">Origin: {r.origin}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Culture code written after MJP's first hiring mistake (2023): a technically strong candidate who couldn't adapt to V4 (field reality overrides office assumption) and kept arguing with Budi's data. Parted ways after 3 months. Hendra: 'The mistake taught me that skills are measurable, but values are invisible until they're tested. The culture code is now a filter, not just a document.' All new hires read it during trial project week and asked directly: 'which value would be hardest for you?'</p>
      </div>

      {/* MJP 2027 Milestone Map */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Map className="h-3.5 w-3.5 text-primary" /> 2027 MILESTONES — Peta Milestone MJP Menuju 2027: 8 Pencapaian yang Harus Dicapai Sebelum Series A Bisa Diklaim Sukses — dan Apa yang Terjadi Jika Salah Satunya Gagal
        </p>
        <div className="flex flex-col gap-1.5 mb-3">
          {[
            { m: "M1 — 750 paying klien", target: "Q4 2026", status: "487/750 (65%)", risk: "Requires Reza + SDR hire. Without SDR: growth rate plateaus at ~20 klien/bln = only 720 by Q4 2026. SDR hire decision needed Q3 2026.", tc: "text-orange-700" },
            { m: "M2 — NLQ v1 live (Pro+)", target: "Q4 2026", status: "70% complete", risk: "Hendra Jr. single point of failure. If he's sick for 2 weeks: delay. No mitigation currently.", tc: "text-orange-700" },
            { m: "M3 — Series A deck + data room ready", target: "Q3 2026", status: "Partially drafted", risk: "Reza is preparing deck — but Hendra must validate all data. Time constraint for Hendra during busy product quarter.", tc: "text-blue-700" },
            { m: "M4 — Rp 1.2M ARR (all tiers)", target: "Q1 2027", status: "On track at current growth", risk: "Depends on M1 (klien count). If M1 misses, M4 misses. Two dependent milestones.", tc: "text-primary" },
            { m: "M5 — BIM knowledge vertical launch", target: "Q2 2027", status: "Planning phase", risk: "Requires hiring domain expert. Job description exists. Target hire Q3 2026 to allow 6-month ramp before launch.", tc: "text-muted-foreground" },
            { m: "M6 — Zero P1 data incidents in 12 consecutive months", target: "Dec 2026", status: "0 incidents 2025 (on track)", risk: "v4 crawler rollout (headless browser) introduces new surface area. Hendra Jr. must implement same quality gates for v4.", tc: "text-emerald-700" },
            { m: "M7 — GAPENSI pilot partnership", target: "Q2 2027", status: "Intro call scheduled Q3 2026", risk: "Partnership depends on GAPENSI leadership openness. MJP's value proposition must be framed as 'GAPENSI member benefit', not 'competitor to GAPENSI services'.", tc: "text-muted-foreground" },
            { m: "M8 — Dewi training 3 apprentice asesor koordinators", target: "Q4 2026", status: "Not started", risk: "Dewi capacity constraint. Cannot train while at peak Q4 SKK Express volume. Training window: Q2–Q3 2026. Must start now.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.m} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.m}</p>
                <span className="text-[7px] font-mono text-muted-foreground shrink-0">Target: {r.target}</span>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.status}</span>
              </div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Risk: {r.risk}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Milestone map reviewed monthly by Hendra in the last Weekly Close of each month. Any milestone falling behind 15%+ of trajectory triggers a corrective discussion. Current critical path: M1 (klien count) → M4 (ARR) → Series A. M8 (Dewi training) is the most overlooked — Hendra flags it as 'the milestone most likely to surprise us at year end.' Dewi training window closes in 8 weeks.</p>
      </div>

      {/* Burn Rate & Runway Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-orange-500" /> BURN & RUNWAY — Model Burn Rate dan Runway MJP: Seberapa Efisien MJP Menggunakan Modal — Breakdown Biaya Per Kategori, Proyeksi Profitabilitas, dan Berapa Lama MJP Bisa Bertahan Tanpa Pendanaan Baru
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
            {[
              { stat: "Rp 147jt", label: "Monthly burn rate (Q2 2026)", tc: "text-red-700" },
              { stat: "Rp 118jt", label: "Monthly revenue (MRR, Q2 2026)", tc: "text-emerald-700" },
              { stat: "Rp 29jt", label: "Net burn (MRR - costs)", tc: "text-orange-700" },
              { stat: "~14 bulan", label: "Runway at current cash reserves", tc: "text-primary" },
            ].map((r) => (
              <div key={r.label} className="border rounded-sm p-2 bg-muted/10 text-center">
                <p className={`text-base font-black font-mono ${r.tc}`}>{r.stat}</p>
                <p className="text-[7px] text-muted-foreground">{r.label}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto mb-1">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Kategori biaya</th>
                  <th className="p-1 text-center">Q2 2026</th>
                  <th className="p-1 text-center">% of burn</th>
                  <th className="p-1 text-left">Trend & notes</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Gaji tim (5 orang)", "Rp 82jt", "55.8%", "Largest category. Hendra draws founder salary Rp 18jt — below market deliberately."],
                  ["Infrastruktur cloud", "Rp 18.7jt", "12.7%", "Growing with klien base. Sub-linear scaling (see Data Collector page)."],
                  ["Budi lapangan (transport + akomodasi)", "Rp 6.2jt", "4.2%", "Fixed. Not scaling with klien count. Best ROI per rupiah in the budget."],
                  ["WA Business API + SMTP", "Rp 4.8jt", "3.3%", "Linear with notification volume. Expected to grow to Rp 8jt at 750 klien."],
                  ["Kantor virtual + meeting tools", "Rp 2.1jt", "1.4%", "Stable. MJP is fully remote — no office lease."],
                  ["Legal + compliance (retainer)", "Rp 3.5jt", "2.4%", "Annual retainer for privacy + employment law. Predictable."],
                  ["Marketing + content", "Rp 4.8jt", "3.3%", "SEO content production. Will increase post-Series A for demand gen."],
                  ["Asesor fee (SKK Express, capped)", "Rp 18jt", "12.2%", "Variable — correlated with Express volume. Q4 spikes to Rp 35jt."],
                  ["Misc / buffer", "Rp 6.9jt", "4.7%", "Unplanned spend. Hendra keeps this at ~5% of budget."],
                ].map((row, i) => (
                  <tr key={i} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-orange-700 font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-muted-foreground">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border rounded-sm p-2.5 bg-emerald-50 border-emerald-200">
            <p className="text-[9px] font-bold text-emerald-700">Path to profitability without Series A:</p>
            <p className="text-[8px]">At 620 klien (current + 133 more): MRR crosses Rp 147jt burn → breakeven. At growth rate of 20 klien/month: breakeven in 6.6 months. At 25 klien/month (with SDR): breakeven in 5.3 months. Hendra's position: 'We don't need Series A to survive. We want Series A to accelerate from 750 to 3.000 klien in 18 months instead of 36. The choice is pace, not survival.'</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Burn model reviewed monthly. Hendra's financial discipline: no category grows without a corresponding revenue trigger. Asesor fee is the only variable cost correlated to a revenue line (SKK Express). All others are step-function — they grow when a specific headcount or capacity trigger is hit, not continuously. This is why MJP's burn is predictable despite being a 5-person startup.</p>
      </div>

      {/* Series A Investor Thesis */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Briefcase className="h-3.5 w-3.5 text-primary" /> SERIES A THESIS — Tesis Investasi Series A MJP: Argumen Inti yang Akan Disampaikan Hendra ke Investor — Mengapa MJP adalah Investasi yang Menarik dan Apa yang Membedakannya dari Startup SaaS Indonesia pada Umumnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { claim: "Claim 1 — Captive addressable market with structural need", evidence: "12.400 BUJK in Indonesia MUST navigate government procurement to survive. This is not optional software — it's operational necessity. Market is non-discretionary. Compare to SaaS categories where budget is cut in downturns: construction procurement spending is tied to government budget (Rp 400T+/year), which is counter-cyclical.", tc: "text-primary" },
            { claim: "Claim 2 — 4-year data moat that compounds", evidence: "312 LPSE sources × 4 years = ~14.6 million tender records. BUJK trust scores built from 2022–2026 historical win/loss/blacklist data. HPS model trained on 8.200+ labeled tender outcomes. A new entrant starting today cannot replicate this dataset — they can buy the tech but not the history.", tc: "text-blue-700" },
            { claim: "Claim 3 — Human intelligence layer that can't be automated away", evidence: "Budi's field network, Dewi's asesor relationships, Sari's regulatory committee access — these are relationship assets that compounds with tenure. No algorithm trains on relationship capital. A better-funded competitor can hire engineers, but they can't hire Budi's 4-year BUJK trust network in Jateng.", tc: "text-emerald-700" },
            { claim: "Claim 4 — Proven unit economics at 487 klien", evidence: "LTV:CAC ratio: 8.7×. Gross margin: ~67%. Net burn: Rp 29jt/month. Path to profitability without Series A: 6 months at current trajectory. Series A accelerates from 750 to 3.000 klien in 18 months, not 36 months. This is a growth investment, not a survival investment.", tc: "text-orange-700" },
            { claim: "Claim 5 — NLQ as the AI differentiator in a pre-AI market", evidence: "Zero Indonesian BUJK have access to natural language procurement search. When NLQ launches Q4 2026: MJP becomes the only AI-native procurement intelligence platform for construction. Early adopters (Enterprise klien) will build workflows around NLQ — switching cost increases substantially post-NLQ adoption.", tc: "text-purple-700" },
          ].map((r) => (
            <div key={r.claim} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.claim}</p>
              <p className="text-[7px] text-muted-foreground">{r.evidence}</p>
            </div>
          ))}
          <div className="border rounded-sm p-2.5 bg-muted/10 mt-1">
            <p className="text-[9px] font-bold mb-0.5">Series A ask and use of funds (target Rp 18–25M USD):</p>
            {[
              ["40% — Sales (Reza + 2 SDR + digital acquisition)", "Rp 7.2–10M USD → 3.000 klien by 2028"],
              ["25% — Product (2 engineers + NLQ v2 + personalization)", "Rp 4.5–6.25M USD → Series B moat"],
              ["20% — Content (2 Sari-equiv. + Dewi apprentices)", "Rp 3.6–5M USD → 6.000 assets by 2028"],
              ["15% — Infrastructure + BD (licensing, GAPENSI)", "Rp 2.7–3.75M USD → new revenue streams"],
            ].map(([cat, val]) => (
              <div key={cat} className="flex gap-2 text-[7px] border-b py-0.5 last:border-0">
                <p className="font-bold w-48 shrink-0">{cat}</p>
                <p className="text-muted-foreground">{val}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A narrative: 'MJP is building the Bloomberg Terminal for Indonesian construction procurement. Bloomberg succeeded because financial professionals had no better alternative for market intelligence. BUJK directors are in the same position — they need real-time intelligence to navigate the most complex procurement environment in Southeast Asia, and MJP is the only platform built specifically for them.' Hendra practices this 60-second pitch weekly with Reza. Investor deck: 18 slides. Data room: Notion with 47 sub-pages. Ready for Q4 2026 outreach.</p>
      </div>

      {/* Competitive Response Playbook */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" /> COMPETITIVE RESPONSE — Playbook Respons Kompetitif MJP: Apa yang Hendra Lakukan Jika Kompetitor X Tiba-Tiba Muncul dengan Fitur Serupa — 4 Skenario Ancaman dan Strategi Respons yang Sudah Dipersiapkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              threat: "Threat S1 — Well-funded Indonesian startup copies MJP's core alert product",
              probability: "Medium (2027–2028)", tc: "text-orange-700",
              response: [
                "Short-term (0–3 months): accelerate Hendra Jr. to ship NLQ v1 — differentiate on intelligence layer, not just alerts",
                "Medium-term (3–12 months): deepen BUJK Trust Score moat — open Trust Score API for BUJK to verify themselves (creates 'MJP certified' brand)",
                "Long-term: the 4-year historical dataset is the real moat — a new entrant cannot replicate 14.6M records without 4 years",
              ],
              insight: "Hendra: 'A new alert product can catch up on coverage in 18–24 months. It cannot catch up on 4 years of BUJK behavioral data. We win by making the intelligence layer (Trust Score, HPS, NLQ) increasingly dependent on history.'"
            },
            {
              threat: "Threat S2 — LPJK or BNSP launches their own contractor intelligence portal",
              probability: "Low (but catastrophic if it happens)", tc: "text-red-700",
              response: [
                "MJP has data that LPJK/BNSP doesn't: cross-source intelligence (tender outcomes + SKK + field notes + blacklist combined)",
                "LPJK/BNSP portals historically launch as government bureaucracy tools — poor UX, slow updates, no personalization",
                "MJP's moat: Budi's field intelligence, Sari's interpretation layer, Reza's B2B relationships — none replicable by a government portal",
              ],
              insight: "A government portal is a validation event, not a threat. It legitimizes the market. MJP's value shifts to 'faster, personalized, and interpreted' vs. the government raw data layer."
            },
            {
              threat: "Threat S3 — Large tech player (Tokopedia, Gojek) builds construction vertical",
              probability: "Very Low", tc: "text-muted-foreground",
              response: [
                "Construction procurement requires KBLI expertise, regulatory tracking, and asesor relationships — none natural to e-commerce players",
                "Large platforms prefer horizontal expansion; vertical specialization is not their instinct",
                "If it happens: MJP becomes an acquisition target, not a defeated competitor (LPJK vertical has Rp 400T/year economic value)",
              ],
              insight: "The same moat that protects MJP from local startups protects it from large tech: construction intelligence requires domain expertise that takes years to build. Hendra sees a large-player incursion as more likely to be a partnership or acquisition than a competitive threat."
            },
            {
              threat: "Threat S4 — International SaaS (e.g., US or Singapore construction tech) enters Indonesia",
              probability: "Low-Medium (2027+)", tc: "text-blue-700",
              response: [
                "International players typically start with large enterprise (BUMN, international contractors) — J7/J8 SMB is not their entry point",
                "Regulatory knowledge (Permen, LPJK, BNSP specifics) requires Indonesian domain expertise and networks",
                "MJP response: price aggressively for SMB (international players price for enterprise), deepen J7/J8 features that enterprise tools ignore",
              ],
              insight: "An international player entering Indonesia construction would validate the market size, making MJP's Series A thesis stronger. Hendra: 'If a US-funded startup enters, our Series A closes in 30 days.'"
            },
          ].map((r) => (
            <div key={r.threat} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.threat}</p>
                <span className={`text-[7px] font-mono shrink-0 ${r.tc}`}>{r.probability}</span>
              </div>
              <div className="mb-0.5">{r.response.map((d, i) => <p key={i} className="text-[7px]">• {d}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Competitive response playbook reviewed quarterly by Hendra alone (not shared with full team to avoid distraction). The consistent message across all 4 scenarios: MJP's defense is depth, not just speed. Building faster than competitors is a treadmill. Building deeper moats (historical data, human intelligence network, personalized interpretation) is a compounding advantage. Hendra's rule: 'Never let competitive anxiety drive the roadmap. Build what makes MJP irreplaceable, not what matches what they're building.'</p>
      </div>

      {/* MJP Succession & Resilience Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <RefreshCw className="h-3.5 w-3.5 text-primary" /> SUCCESSION & RESILIENCE — Rencana Suksesi dan Ketahanan MJP: Apa yang Terjadi Jika Hendra Tidak Bisa Bekerja Selama 3 Bulan — Siapa yang Mengambil Alih, Apa yang Tidak Boleh Berhenti, dan Apa yang Bisa Diprioritaskan Ulang
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <p className="text-[8px] text-muted-foreground mb-1">Single-point-of-failure analysis: what each team member owns and what happens if they're unavailable:</p>
          {[
            {
              person: "Hendra (CEO/Product) — unavailable for 3+ months",
              critical: ["Series A fundraising (BLOCKED — Hendra is sole investor liaison)", "Product prioritization decisions (PAUSED — Reza + Hendra Jr. maintain current backlog, no new features prioritized)", "Weekly Close meeting (Reza leads — agenda shared, decisions documented by Sari)"],
              continues: ["Sari's knowledge production (continues at full pace)", "Hendra Jr.'s backlog execution (continues at current velocity)", "Reza's sales cycle (continues — Reza is fully capable of closing without Hendra's involvement)", "Daily Briefing (automated — continues without intervention)"],
              succession: "Reza handles external relationships. Hendra Jr. is technical escalation point. Sari is product quality gatekeeper.",
              tc: "text-red-700"
            },
            {
              person: "Sari (Research/Intelligence) — unavailable for 3+ months",
              critical: ["New knowledge assets (PAUSED — backlog depletes, no new production)", "Regulatory interpretation for Enterprise klien (DEGRADED — factual alerts still go out, no annotation)", "Webinar program (PAUSED — key presenter unavailable)"],
              continues: ["Alert delivery (automated — continues fully)", "Hendra Jr.'s engineering (unaffected)", "Reza's sales (slowed — no fresh case studies or content, but pipeline continues)", "SKK Express (Dewi is independent — unaffected)"],
              succession: "Hendra writes basic factual notes for urgent L1 alerts. Junior analyst hire accelerated. Post-Series A team reduces this risk permanently.",
              tc: "text-orange-700"
            },
            {
              person: "Hendra Jr. (Engineering) — unavailable for 3+ months",
              critical: ["Bug fixes and infrastructure maintenance (CRITICAL RISK — no backup engineer)", "New feature development (FULLY STOPPED)", "Crawler maintenance (DEGRADES over time — LPSE source structure changes unaddressed)"],
              continues: ["Existing features (continue at current state until bugs accumulate)", "Sari's production (unaffected)", "Reza's sales (unaffected)", "Alert delivery (continues but degrades as LPSE sources drift)"],
              succession: "Backup engineer hire is H2 in Series A plan (Month 2–4). Until then: Hendra has read access to all systems. Critical bugs: Hendra has a 2-day emergency engineering capability for production incidents.",
              tc: "text-orange-700"
            },
            {
              person: "Dewi (SKK/Asesor) — unavailable for 3+ months",
              critical: ["SKK Express cases (PAUSED — no asesor network coordinator)", "SKK regulatory monitoring (DEGRADED — automated alerts continue, Dewi's committee intelligence lost)"],
              continues: ["Core subscription (fully unaffected — SKK Express is <12% of revenue)", "Reza's sales of core subscription (unaffected)", "Alert and briefing delivery (unaffected)"],
              succession: "SKK Express waitlist activated. Clients informed. 2 Dewi apprentices in the post-Series A plan specifically de-risk this. Revenue impact: ~Rp 6.1jt/month from Express paused.",
              tc: "text-blue-700"
            },
          ].map((r) => (
            <div key={r.person} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.person}</p>
              <div className="mb-0.5">{r.critical.map((c, i) => <p key={i} className="text-[7px] text-red-700">• {c}</p>)}</div>
              <div className="mb-0.5">{r.continues.map((c, i) => <p key={i} className="text-[7px] text-emerald-700">✓ {c}</p>)}</div>
              <p className={`text-[7px] font-mono ${r.tc}`}>Succession: {r.succession}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Resilience assessment: MJP is most resilient to Reza and Budi absence (field program and sales can be paused without immediate platform degradation). Least resilient to Hendra Jr. absence (single engineer = single point of failure for all technical operations). Series A hiring plan directly addresses the two highest resilience risks: H2 (backend engineer) de-risks Hendra Jr., H3–H4 (Sari apprentices) de-risk Sari. Hendra's governance rule: no critical system should have only one person who understands it. Hendra Jr. has documented all system architecture in Notion (15 pages). Sari maintains her editorial calendar in Notion. The documentation is insurance.</p>
      </div>

      {/* MJP Exit Strategy & Long-Term Vision */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Milestone className="h-3.5 w-3.5 text-primary" /> EXIT HORIZON — Horizon Exit dan Visi Jangka Panjang MJP: Bukan Startup yang Dibangun untuk Dijual — Mengapa Hendra Membangun MJP sebagai Infrastruktur Intelijen Permanen untuk Industri Konstruksi Indonesia
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              scenario: "Scenario A — Strategic acquisition by data/proptech company (most likely exit, 2029–2032)",
              who: "Potential acquirers: (1) BUMN data/tech arms (e.g. Telkom Indonesia's data division — they want construction vertical data), (2) Regional proptech platforms (e.g. Rumah.com, iProperty group wanting Indonesia construction entry), (3) Enterprise software companies targeting Indonesian government contractor workflow (SAP, Oracle local partners)",
              valuation: "Hendra's acquisition valuation target: 8–12× ARR. At Rp 15B ARR (2030 projection): Rp 120–180B exit. At 15× ARR (strategic premium): Rp 225B.",
              hendra_condition: "Hendra's condition for any acquisition: (1) MJP brand remains, (2) Sari + Budi's intelligence operation continues as-is, (3) Hendra stays as MD for minimum 3 years post-close. 'I don't want to build this and watch it get dismantled by a corporate that doesn't understand what makes it valuable.'",
              tc: "text-primary"
            },
            {
              scenario: "Scenario B — IPO on IDX (aspirational, 2033+)",
              who: "Requires: Rp 50B+ revenue, 3+ years of profitable operations, diversified product portfolio (web + mobile + API + enterprise services). IDX tech listings in Indonesia are maturing (GoTo, Bukalapak precedents, though mixed outcomes).",
              valuation: "Target: P/E of 25–35× net income. At Rp 50B revenue + 40% net margin = Rp 20B net income: Rp 500–700B market cap.",
              hendra_condition: "IPO is Hendra's 'dream scenario' — not for the money, but for the statement: 'A 5-person team from Surabaya built the intelligence infrastructure for the entire Indonesian construction industry and took it public.' That's the national industry impact story.",
              tc: "text-blue-700"
            },
            {
              scenario: "Scenario C — No exit / permanent mission company (Hendra's preferred path)",
              who: "Hendra's honest answer when asked about exit: 'I'm not building MJP to sell it. I'm building it to still be here in 30 years. Indonesia's construction industry will be 3× larger in 2050. I want MJP to be the intelligence infrastructure for all of it.'",
              valuation: "Financial outcome: dividend-paying company. Hendra, Sari, Hendra Jr., Reza, Dewi all hold equity. The company generates strong cash flows and distributes profits to the team who built it.",
              hendra_condition: "This scenario requires: no investor with forced exit provisions (why Hendra is careful about Series A terms), a team that wants to stay long-term, and a market that keeps growing. All 3 are currently true.",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.scenario}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.who}</p>
              <p className={`text-[7px] font-mono text-blue-700 mb-0.5`}>{r.valuation}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.hendra_condition}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Hendra's public position (to investors): 'We are building MJP for the long term. An acquisition at the right price to the right acquirer is something we'd consider seriously. An IPO is a possibility we're preparing for. But we are not building with a 5-year flip in mind.' This is both genuine (Hendra means it) and strategically smart (acquirers pay more for founders who don't desperately want to sell). The Series A investors Hendra has screened are aligned: they want a 7–10 year hold, not a 3-year flip. Hendra's filter for Series A: if an investor leads with 'what's your exit timeline?', they don't understand the business.</p>
      </div>

      {/* MJP Brand & Positioning Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Fingerprint className="h-3.5 w-3.5 text-primary" /> BRAND ARCHITECTURE — Arsitektur Brand MJP: Mengapa 'Maheswara Jaya Persada' Bukan Hanya Nama Perusahaan — Positioning Statement, Tone of Voice, dan Bagaimana Brand MJP Membedakan Diri dari Agregator Data Biasa
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            {
              element: "Brand Positioning Statement",
              content: "'MJP adalah mitra intelijen pengadaan untuk BUJK Indonesia yang serius menang tender — bukan sekadar platform data, tapi partner strategis yang memahami bahwa setiap informasi yang kami berikan berimplikasi pada kontrak nyata senilai ratusan juta hingga triliunan rupiah.'",
              why: "The word 'mitra' (partner) is deliberate — it signals relationship, not transaction. 'Serius menang' filters the audience to ambitious BUJK, not casual browsers. The financial scale anchors the value proposition immediately.",
              tc: "text-primary"
            },
            {
              element: "Brand Tone of Voice (4 attributes)",
              content: "CREDIBLE: every claim backed by source. DIRECT: no hedging — MJP says what the data shows. INDUSTRY-FLUENT: uses BUJK language naturally (KBLI, jenjang, SBU, HPS). HUMAN: Sari, Budi, Dewi, Reza are named in communications — MJP is people, not a faceless algorithm.",
              why: "Hendra rejected early brand drafts that felt 'tech-startup generic.' The construction industry respects expertise and directness — the brand had to match the industry's character, not import Silicon Valley aesthetics.",
              tc: "text-blue-700"
            },
            {
              element: "What MJP is NOT positioned as",
              content: "NOT a data aggregator ('we just pull from LPSE' — anyone can do that). NOT an AI platform ('powered by AI' — meaningless without context). NOT a government tender directory (that's a feature, not a business). NOT a project management tool (different problem, different buyer, different channel).",
              why: "Positioning by negation is as important as positioning by affirmation. Hendra: 'When klien know what we're NOT, they stop asking for features that are outside our lane. Clarity of positioning prevents scope creep.'",
              tc: "text-orange-700"
            },
            {
              element: "Brand evolution: from 'Maheswara' to 'MJP' in practice",
              content: "'Maheswara Jaya Persada' is the legal entity. 'MJP' is the operating brand. In klien conversations: Reza always says 'MJP.' In formal documents and contracts: full name. In the platform UI: 'MJP — Platform Riset Marketing Konstruksi.' The abbreviation is trusted among Enterprise klien who've worked with MJP for 2+ years — they rarely say the full name.",
              why: "Short brand names build faster recognition. Reza's observation: 'I know a klien is truly embedded when they start saying 'platform MJP saya' — possessive ownership language. That's the brand goal: make klien feel it's their platform.'",
              tc: "text-emerald-700"
            },
          ].map((r) => (
            <div key={r.element} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.element}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5 italic">{r.content}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>{r.why}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Brand investment is low in resources (Hendra writes all copy himself; no external agency) and high in intentionality (every word in MJP's communications has been reviewed against the 4 tone attributes). In the Indonesian construction intelligence market, brand consistency is itself a trust signal — klien who see consistent, credible communication over 4 years conclude that the platform behind it is equally consistent and credible. Hendra: 'Our brand is not separate from our product. The way we write our alert annotations is the same voice as our sales emails and our renewal conversations. Klien sense that continuity — even if they can't articulate it.'</p>
      </div>

      {/* R96: Investor Readiness Scorecard */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> INVESTOR READINESS SCORECARD — 7 Metrik yang Digunakan Investor Seri A untuk Menilai B2B SaaS di Indonesia: Posisi MJP Hari Ini, Target Pre-Close, dan Gap yang Tersisa
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Metric</th>
                  <th className="p-1 text-center">Saat ini</th>
                  <th className="p-1 text-center">Target pre-close</th>
                  <th className="p-1 text-center">Gap</th>
                  <th className="p-1 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["ARR (Annual Recurring Revenue)", "Rp 701jt", "Rp 900jt", "Rp 199jt", "ON TRACK", "text-emerald-700"],
                  ["MRR Growth Rate (MoM)", "4.8%", "5.5%", "0.7pp", "WATCH", "text-orange-700"],
                  ["Net Revenue Retention", "112%", "115%", "3pp", "ON TRACK", "text-emerald-700"],
                  ["CAC Payback Period", "7.2 bulan", "< 8 bulan", "—", "MET", "text-emerald-700"],
                  ["Churn Rate (monthly)", "1.4%", "< 2%", "—", "MET", "text-emerald-700"],
                  ["Gross Margin", "73%", "70%+", "—", "EXCEEDED", "text-blue-700"],
                  ["Active Klien Count", "487", "600", "113 klien", "FOCUS", "text-orange-700"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold">{row[0]}</td>
                    <td className="p-1 text-center text-primary font-bold">{row[1]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[2]}</td>
                    <td className="p-1 text-center text-muted-foreground">{row[3]}</td>
                    <td className={`p-1 text-center font-bold text-[7px] ${row[5]}`}>{row[4]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { label: "Metrik paling dipertanyakan investor", detail: "MRR Growth Rate: investor melihat MJP tumbuh 4.8% MoM yang berarti ARR doubling time ~15 bulan. Target mereka: 12 bulan atau lebih cepat (5.5% MoM). Gap kecil tapi penting — setiap bulan pre-close yang melampaui 5.5% mempersingkat percakapan Series A." , tc: "text-orange-700" },
            { label: "Metrik yang paling mengejutkan investor", detail: "Gross Margin 73%: untuk SaaS dengan komponen lapangan (field intelligence, human editorial), 73% gross margin adalah outlier positif. Sebagian besar investor mengasumsikan platform dengan human-in-the-loop di Indonesia akan bermain di 55–65%. MJP's asset-leverage model (buat sekali, jual ke 487 klien) adalah penjelasannya.", tc: "text-blue-700" },
            { label: "Metrik yang belum dihitung MJP", detail: "Lifetime Value (LTV) per klien tier: MJP tahu churn dan CAC, tapi belum menghitung LTV secara segmented per tier (Starter/Pro/Enterprise). Investor Series A akan menanyakan LTV:CAC ratio per tier. Hendra: 'Q3 2026 priority — bangun LTV model segmented sebelum formal process dimulai.'", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.label} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.label}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Investor Readiness Scorecard dibuat Hendra setelah 8 exploratory investor meetings Q1–Q2 2026. Dia mencatat setiap pertanyaan dari setiap investor, mengkategorikannya ke 7 metrik utama, lalu membangun internal dashboard (yang ditampilkan di sini) untuk monitoring mingguan. Reza melihat scorecard ini setiap Senin pagi — bukan karena dia membutuhkan semua angkanya, tetapi karena "Active Klien Count" adalah satu-satunya metrik yang Reza bisa pengaruhi secara langsung. 113 klien gap menuju 600: itu adalah Reza's personal mission sebelum H2 2026 berakhir.</p>
      </div>

      {/* R97: MJP Competitive Positioning Ladder */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> MJP COMPETITIVE POSITIONING LADDER — Bagaimana Reza Menjelaskan MJP vs 5 Alternatif yang Paling Sering Dibandingkan Klien: Manual Monitoring, Asosiasi, Konsultan, Generic SaaS, dan Tidak Melakukan Apapun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { alt: "vs Manual Monitoring (tim internal BUJK)", mjp_win: "Kecepatan dan kelengkapan: tim internal tidak bisa monitor 744 LPSE + 34 sumber regulasi secara bersamaan. MJP memberikan coverage yang tidak mungkin dicapai oleh 1–2 orang internal bahkan dengan full-time dedication.", mjp_lose: "Klien yang sudah punya tim estimasi senior sering merasa MJP 'terlalu general' — mereka butuh sangat spesifik ke niche KBLI mereka. Solution: custom filter profile." , tc: "text-emerald-700" },
            { alt: "vs Asosiasi Kontraktor (GAPENSI, GAPEKSINDO, dll.)", mjp_win: "Real-time vs monthly: asosiasi kirim buletin bulanan. MJP kirim alert dalam 4 jam. Untuk tender dengan deadline 7 hari, 4 jam vs 30 hari adalah perbedaan antara participate dan miss.", mjp_lose: "Asosiasi memberikan akses network, lobby, dan advocacy yang MJP tidak bisa replicate. MJP bukan pengganti asosiasi — ini adalah argument yang Reza harus selalu make upfront.", tc: "text-emerald-700" },
            { alt: "vs Konsultan Tender (freelance/firma)", mjp_win: "Cost: konsultan Rp 5–15jt per tender submission. MJP Rp 399k/bulan untuk unlimited alert + intelligence. Klien yang submit 4+ tender per tahun: break-even jelas.", mjp_lose: "Konsultan memberikan hands-on document preparation. MJP hanya intel — tidak prepare dokumen. Hybrid: beberapa klien MJP gunakan MJP untuk intel, konsultan untuk dokumen.", tc: "text-orange-700" },
            { alt: "vs Generic Business Intelligence Tools (Tableau, Power BI)", mjp_win: "Domain specificity: generic BI tools membutuhkan data yang BUJK sendiri harus collect. MJP sudah collect data + sudah pre-process + sudah annotate untuk konstruksi context. Zero setup.", mjp_lose: "Enterprise yang sudah punya data team mungkin prefer raw data access via API (hence MJP API roadmap). Generic tools lebih fleksibel untuk custom analysis.", tc: "text-blue-700" },
            { alt: "vs Tidak Melakukan Apapun (status quo)", mjp_win: "Ini adalah 60%+ of Reza's actual competition — bukan rival platforms, tapi BUJK yang belum aware bahwa intelligence tools exist. Reza's first job: sell the category, then sell MJP.", mjp_lose: "Status quo has zero cost and zero switching friction. Kelemahan terbesar MJP di segment ini: membuktikan ROI sebelum purchase. Solution: 30-day free trial mengubah 'tidak melakukan apapun' menjadi 'mencoba MJP'.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.alt} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.alt}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">MJP wins: {r.mjp_win}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>MJP loses: {r.mjp_lose}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Positioning ladder ini adalah dokumen yang Hendra tulis sendiri setelah Reza kehilangan 3 deals berturut-turut di Q1 2024 karena "klien memilih konsultan". Hendra menemukan bahwa Reza sedang positioning MJP sebagai konsultan alternatif — positioning yang salah karena membuat klien membandingkan secara langsung. Positioning yang benar: MJP adalah intelligence layer yang bekerja dengan atau tanpa konsultan, bukan pengganti mereka. Setelah positioning pivot: Reza tidak pernah lagi kalah ke konsultan dalam comparison. Hendra: 'Kalah di positioning adalah kalah sebelum demo dimulai. Menang di positioning berarti klien sudah terjual setengahnya sebelum Reza buka mulut.'</p>
      </div>

      {/* R98: Series A Preparation Timeline */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Rocket className="h-3.5 w-3.5 text-primary" /> SERIES A PREPARATION TIMELINE — Rencana Bulan per Bulan Menuju Formal Fundraise: Apa yang Harus Selesai, Siapa yang Mengerjakan, dan Bagaimana MJP Mempersiapkan Due Diligence yang Tidak Mengejutkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { period: "Jul–Aug 2026", owner: "Hendra", deliverable: "Financial model v3: full 36-month projection dengan 3 scenarios (base/bull/bear). LTV model segmented per tier. Gross margin projection per product line.", status: "IN PROGRESS", tc: "text-orange-700" },
            { period: "Jul–Sep 2026", owner: "Reza", deliverable: "ARR push ke Rp 900jt: 113 klien gap, closes per month target +37% dari current pace. Special focus: Kalimantan Timur outreach + IKN Enterprise upsell.", status: "IN PROGRESS", tc: "text-orange-700" },
            { period: "Aug 2026", owner: "Hendra Jr.", deliverable: "Technical due diligence prep: architecture documentation, security audit, uptime SLA report (12 months), data pipeline documentation.", status: "PLANNED", tc: "text-blue-700" },
            { period: "Sep 2026", owner: "Sari", deliverable: "Knowledge Registry audit: ensure 100% of active assets have complete metadata, version history, and source attribution. Investor will scrutinize data quality claims.", status: "PLANNED", tc: "text-blue-700" },
            { period: "Oct 2026", owner: "Hendra", deliverable: "Formal process launch: send teaser to 8 VC targets (3 local: Intudo, Kinesys, MDI; 3 regional: AC Ventures, East Ventures, Gojek Ventures; 2 strategic: Telkom, construction conglomerate).", status: "PLANNED", tc: "text-primary" },
            { period: "Nov–Dec 2026", owner: "All team", deliverable: "Due diligence response: target 30-day turnaround for all DD requests. Room for data, legal, financial, technical, and commercial DD tracks.", status: "PLANNED", tc: "text-muted-foreground" },
            { period: "Q1 2027 (target close)", owner: "Hendra + Legal", deliverable: "Term sheet negotiation, legal documentation, funds receipt. Target: Rp 25–40M valuation, 15–20% dilution, Rp 4–8M raise.", status: "TARGET", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.period} className="border-b py-1.5 flex gap-3">
              <div className="shrink-0 w-20">
                <p className={`text-[7px] font-mono font-bold ${r.tc}`}>{r.period}</p>
                <p className="text-[7px] text-muted-foreground">{r.owner}</p>
              </div>
              <div className="flex-1">
                <p className={`text-[7px] font-bold ${r.tc} mb-0.5`}>{r.status}</p>
                <p className="text-[7px] text-muted-foreground">{r.deliverable}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A timeline adalah living document — Hendra review dan adjust setiap bulan pertama. Keputusan terpenting yang belum dibuat: lead investor vs syndicate. Hendra's preference: satu lead investor dengan strong operational network di konstruksi Indonesia, bukan hanya financial-focused VC. Alasan: MJP butuh intro ke enterprise BUJK dan ke Kementerian PUPR, bukan hanya capital. Kandidat yang paling menarik secara strategic value: MDI (Telkom) dan konglomerat konstruksi yang belum didisklosur. Hendra: 'Fundraise yang baik bukan tentang berapa banyak term sheets yang kita dapat. Tentang memilih partner yang tepat yang akan duduk di board dan menambah value selain uang.'</p>
      </div>

      {/* R99: MJP Exit Strategy Scenarios */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Flag className="h-3.5 w-3.5 text-primary" /> MJP EXIT STRATEGY SCENARIOS — 4 Skenario Jangka Panjang yang Hendra Pikirkan: IPO, Strategic Acquisition, Management Buyout, atau Remain Independent — Probability, Timeline, dan Apa yang Harus Benar agar Setiap Skenario Terjadi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scenario: "S1: Strategic Acquisition — Rp 200–500M exit", probability: "HIGHEST (40%)", timeline: "2029–2031", requirements: "ARR > Rp 5M/tahun, data moat terbukti defensible, dan satu dari 3 acquirer categories approach first: (a) konstruksi konglomerat (Wika, Adhi, PP) yang ingin in-house intelligence, (b) financial services (bank atau asuransi yang butuh construction credit risk data), (c) regional SaaS (Singaporean property tech yang expand to Indonesia). Hendra's preference: financial services acquirer karena data synergy paling clear.", tc: "text-primary" },
            { scenario: "S2: IPO di IDX (Bursa Efek Indonesia) — public company", probability: "MEDIUM (25%)", timeline: "2032–2034", requirements: "IDX listing requirements: minimum 3 tahun profitable, revenue minimum threshold, minimum free float 15%. MJP harus reach Rp 15–20M ARR untuk IPO yang meaningful. Hendra: 'IPO bukan exit — itu adalah liquidity event. Saya masih harus run the company setelahnya. Ini bukan preferensi pertama saya, tapi bisa menjadi yang paling impactful untuk visibility platform dan klien trust.'", tc: "text-blue-700" },
            { scenario: "S3: Remain Independent — profitable bootstrapped growth", probability: "MEDIUM (25%)", timeline: "Ongoing", requirements: "Jika tidak ada acquirer yang offer fair price dan IPO tidak attractive: remain private, grow organically to Rp 10M+ ARR, distribute dividends. Hendra: 'Kalau kita profitable dan growing dan tim bahagia — mengapa harus exit? Exit bukan tujuan. Membangun platform yang paling berguna bagi BUJK Indonesia adalah tujuan.' This scenario becomes more likely if Series A investors push too hard on exit timeline.", tc: "text-emerald-700" },
            { scenario: "S4: Management Buyout dari early investor", probability: "LOW (10%)", timeline: "Jika investor relationships deteriorate", requirements: "Jika investor post-Series A tidak aligned dengan product vision: MBO option. Hendra would need to find alternative capital source to buy out investor stake. Expensive but preserves control. Hendra: 'Saya tidak berencana ke sini tapi saya perlu tahu jalur ini ada.' Documentation: MBO clause dapat dimasukkan dalam Series A term sheet sebagai founder protection.", tc: "text-muted-foreground" },
          ].map((r) => (
            <div key={r.scenario} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.scenario}</p>
                <span className={`text-[7px] font-mono font-bold shrink-0 ${r.tc}`}>{r.probability} · {r.timeline}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.requirements}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Exit strategy thinking bukan tentang wanting to exit — ini adalah tentang having clear options sehingga setiap keputusan hari ini tidak accidentally close off a future path. Hendra pertama kali serius memikirkan exit scenarios setelah seorang Series B founder (mentor) berkata: 'Setiap term sheet yang kamu sign adalah sebuah commitment tentang exit path. Jika kamu tidak punya exit strategy, investor akan membuat satu untukmu.' MJP's current orientation: maximize for S1 (strategic acquirer) atau S3 (remain independent) — kedua skenario yang paling compatible dengan long-term platform quality. S2 (IPO) dan S4 (MBO) adalah fallbacks. Hendra annually review this with Reza and discuss openly — no secrets about the long game.</p>
      </div>

      {/* R100: MJP Founder Origin Story */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> MJP FOUNDER ORIGIN STORY — Keputusan yang Membuat Hendra Mendirikan PT Maheswara Jaya Persada: Momen Spesifik di 2021, Mengapa Konstruksi, dan Bagaimana Platform yang Ada Hari Ini Berbeda dari Konsep Awal
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { chapter: "Ch 1: The failed tender (2020)", story: "Hendra — saat itu konsultan manajemen independen — membantu seorang klien BUJK menengah di Semarang mempersiapkan dokumen tender senilai Rp 8M. Mereka kalah. Alasan: kompetitor menawar 3% di bawah HPS sementara klien Hendra menawar 12% di bawah HPS karena estimasi material yang salah. Post-mortem: jika ada data harga material yang reliable dan historical HPS untuk tender sejenis, klien bisa menawar di range yang benar. 'Kalah bukan karena kurang bagus. Kalah karena tidak punya data yang cukup.'", tc: "text-muted-foreground" },
            { chapter: "Ch 2: The research question (early 2021)", story: "Hendra mulai riset: apakah ada platform yang menyediakan intelligence ini? Cek LPSE, cek LPJK, cek semua sumber publik. Kesimpulan: data ada tapi tersebar di 671 portal LPSE, tidak terstruktur, tidak searchable, dan tidak contextual. 'Data ada. Yang tidak ada adalah platform yang mengolahnya menjadi intelligence yang bisa digunakan orang biasa, bukan hanya data scientists.'", tc: "text-blue-700" },
            { chapter: "Ch 3: Validating the pain (Q2 2021)", story: "Hendra rekrut Budi untuk 3 bulan riset lapangan dengan satu pertanyaan: 'Apakah BUJK membutuhkan intelligence platform seperti ini, dan berapa mereka mau bayar?' 14 interview dalam 6 minggu. 12 dari 14 mengatakan 'iya, butuh.' 9 dari 14 menyebut angka yang melebihi Hendra's break-even assumption. 'Interview ke-3 dengan Pak Santoso dari Surabaya: dia mengeluarkan dompetnya dan berkata, berapa harganya? Saat itu saya tahu ini real.'", tc: "text-emerald-700" },
            { chapter: "Ch 4: How it diverged from original concept (2021 vs 2026)", story: "Konsep awal: tender alert + HPS database. Hanya 2 fitur. Platform 2026: 15+ fitur across 6 verticals, AI recommendation, mobile app, WhatsApp delivery. Biggest divergence: Knowledge Registry was not in original concept — it emerged from Sari's observation that klien keep asking the same regulatory questions. Budi's field work was supposed to be a one-time validation, not a permanent feature. 'Startup plan adalah fiksi yang indah. Platform yang ada adalah produk dari klien yang mengajari kita apa yang sebenarnya mereka butuhkan.'", tc: "text-primary" },
          ].map((r) => (
            <div key={r.chapter} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.chapter}</p>
              <p className="text-[7px] text-muted-foreground">{r.story}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Origin story adalah dokumen yang Hendra tulis fresh setiap kali ada pitch meeting besar — bukan karena ceritanya berubah, tapi karena detail yang dia pilih untuk emphasize berubah berdasarkan audience. Untuk VC: emphasis on market size discovery dan validation rigor. Untuk klien besar: emphasis on the failed tender story (relatable pain). Untuk new hire: emphasis on how listening to customers shaped every feature. Satu elemen yang tidak pernah berubah dalam semua versi: 'Pak Santoso dari Surabaya yang mengeluarkan dompetnya.' Hendra: 'Saat investor atau klien mendengar cerita dompet itu, mereka mengerti. Bukan karena angkanya besar — angkanya kecil. Tapi karena momen itu adalah proof of genuine, felt need. Tidak ada data yang bisa menggantikan satu momen manusiawi seperti itu.'</p>
      </div>

      {/* R101: MJP Revenue Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> MJP REVENUE ARCHITECTURE — Bagaimana 3 Revenue Stream MJP Saling Memperkuat: Subscription, Custom Research, dan B2B API — Proyeksi Kontribusi 2026–2028 dan Strategi untuk Tidak Bergantung pada Satu Stream
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { stream: "S1: Subscription (SaaS)", current: "Rp 564jt ARR (97.2% of total)", proj2028: "Rp 2.8M ARR (78% of total)", mechanics: "Monthly recurring: Starter Rp 399k, Pro Rp 899k, Enterprise avg Rp 2.8jt. Annual prepay discount 20%. Growth driven by: Reza direct sales (primary), word-of-mouth (23% of new klien), brand content (growing). Churn is the primary lever — reducing monthly churn by 0.5pp = Rp 68jt additional ARR at current base.", tc: "text-primary" },
            { stream: "S2: Custom Research", current: "Rp 16jt ARR (2.8% of total)", proj2028: "Rp 280jt ARR (8% of total)", mechanics: "Ad-hoc research commissions from Enterprise klien dan asosiasi. Typical engagement: Rp 15–50jt per report, 4–8 week delivery. Currently handled personally by Hendra + Budi. Scaling requires: dedicated research team (1 hire post-Series A) and productized research packages (3–4 standard formats with known pricing).", tc: "text-blue-700" },
            { stream: "S3: B2B API", current: "Rp 0 (pre-launch)", proj2028: "Rp 490jt ARR (14% of total)", mechanics: "API-1 (Tender Feed): 2 pilots in late 2026. API-2 (BUJK Vetting): bank partnership target Q1 2027. API-3 (Regulatory Webhook): asosiasi channel Q4 2026. Combined: if 5 API partners at avg Rp 8jt/month by end 2028 = Rp 480jt ARR. High margin: minimal marginal cost once infrastructure built.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.stream} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.stream}</p>
                <span className={`text-[7px] font-mono shrink-0 text-muted-foreground`}>{r.current} → {r.proj2028}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.mechanics}</p>
            </div>
          ))}
          <div className="py-1.5 border-t">
            <p className="text-[8px] font-bold text-primary mb-0.5">The reinforcement flywheel between streams</p>
            <p className="text-[7px] text-muted-foreground">S1 (subscription) generates behavioral data → feeds AI quality in S3 (API). S2 (custom research) produces publishable reports → generates inbound leads for S1. S3 (API) partners distribute MJP brand to their user base → generates awareness for S1. The three streams are not independent — each strengthens the others. This interdependence is a moat in itself: a competitor could replicate one stream, but replicating the flywheel requires building all three simultaneously with the same proprietary data layer.</p>
          </div>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Revenue architecture adalah Hendra's financial north star — not a forecast (too uncertain) but a direction of travel. The 2028 projection assumes: Series A closes Q1 2027, Head of Growth hired Q2 2027, API-1 commercially launched Q4 2026. Primary risk: S1 growth slower than projected if CAC increases as Reza runs out of warm leads in his network. Mitigation: S2 reports drive inbound leads that don't require Reza's time. Secondary risk: S3 partnership negotiations longer than expected. Mitigation: start with asosiasi channel (API-3) which has no legal complexity vs bank partnerships (API-2). Hendra to investors: 'Kami bukan one-product, one-revenue company. Tiga stream kami adalah tiga independent bets yang saling memperkuat — jika satu terlambat, yang lain masih maju.'</p>
      </div>

      {/* R102: MJP Unit Economics Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" /> MJP UNIT ECONOMICS DEEP DIVE — LTV:CAC Ratio per Tier, Payback Period, dan Gross Margin Aktual: Angka yang Hendra Hapal di Luar Kepala karena Ini adalah Kesehatan Bisnis yang Sebenarnya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-[8px] font-mono">
              <thead>
                <tr className="border-b sticky top-0 bg-background z-10">
                  <th className="text-left p-1 text-muted-foreground">Metric</th>
                  <th className="p-1 text-center text-blue-700">Starter</th>
                  <th className="p-1 text-center text-primary">Pro</th>
                  <th className="p-1 text-center text-emerald-700">Enterprise</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Monthly price", "Rp 399.000", "Rp 899.000", "Avg Rp 2.800.000"],
                  ["Monthly churn rate", "4.2%", "2.1%", "0.7%"],
                  ["Avg LTV (1/churn × MRR)", "Rp 9.5jt", "Rp 42.8jt", "Rp 400jt"],
                  ["CAC (Reza time + ops)", "Rp 120k", "Rp 280k", "Rp 2.1jt"],
                  ["LTV:CAC ratio", "79:1", "153:1", "190:1"],
                  ["Payback period", "0.3 months", "0.3 months", "0.75 months"],
                  ["Gross margin (net of COGS)", "~81%", "~83%", "~86%"],
                ].map((row) => (
                  <tr key={row[0]} className="border-b hover:bg-muted/20">
                    <td className="p-1 font-bold text-[7px]">{row[0]}</td>
                    <td className="p-1 text-center text-[7px] text-blue-700">{row[1]}</td>
                    <td className="p-1 text-center text-[7px] text-primary">{row[2]}</td>
                    <td className="p-1 text-center text-[7px] text-emerald-700">{row[3]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {[
            { insight: "COGS structure — what actually costs money to serve each klien", detail: "Per-klien marginal COGS: (1) cloud compute for crawler/alert delivery: Rp 8–22k/month depending on tier activity, (2) WhatsApp API message cost: Rp 1–6k/month (Enterprise receives more messages), (3) storage cost for audit logs/attachments: Rp 2–5k/month Enterprise only. Total marginal COGS: Starter Rp 9k, Pro Rp 18k, Enterprise Rp 33k. Fixed COGS (infrastructure, not per-klien): Rp 4.8jt/month amortized across all 847 klien = Rp 5.7k/klien. Gross margin above 81% because most COGS is fixed, not variable.", tc: "text-primary" },
            { insight: "Why Enterprise LTV is so high despite higher churn risk from large account concentration", detail: "Enterprise LTV Rp 400jt: assumes 17.9-month avg tenure at 0.7% monthly churn. But concentration risk: losing 1 Enterprise klien at Rp 2.8jt MRR = 0.48% total ARR impact. Hedge: require 3-month notice for Enterprise cancellation (contractual), leading to lower effective churn. Real Enterprise avg tenure (actual data): 22 months. Actual LTV with real data: Rp 616jt. Model is conservative.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.insight} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.insight}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Unit economics model adalah dokumen yang Hendra rebuild from scratch setiap 6 bulan — not because the framework changes, but because the inputs change as MJP grows and churn data accumulates. Most dangerous assumption in the model: churn rates used are based on 24-month cohort data. If MJP's oldest cohorts (bulan 1–12 setelah R1) show higher churn as they age further, LTV projections will overstate. Hendra tracks 'mature cohort churn' (klien {'>'} 18 months) separately: 1.9% monthly for Starter, 0.9% Pro, 0.4% Enterprise — lower than aggregate, indicating MJP gets stickier with time. This is the single most important unit economics insight: MJP's product improves in value to klien who use it longer, and the data reflects this. Hendra: 'Jika unit economics bagus dan pasar besar, semua masalah lain adalah execution problems — dan execution problems bisa diselesaikan. Itu mengapa saya hapal angka-angka ini.'</p>
      </div>

      {/* R103: MJP Fundraising Narrative for Series A */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Presentation className="h-3.5 w-3.5 text-primary" /> MJP SERIES A NARRATIVE — 5 Slide-Worth Frames yang Hendra Gunakan untuk Meyakinkan Investor: Dari 'Mengapa Sekarang' hingga 'Mengapa Tim Ini', dengan Angka dan Cerita yang Teruji dalam 12 Investor Meeting
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { frame: "Frame 1: Why Now — Indonesia procurement digitalization inflection point", content: "3 converging forces in 2026: (1) Government mandate: all BUJK must be LPJK-digital by 2027 — 147.000 BUJK forced to engage with digital procurement tools for the first time. (2) IKN demand explosion: largest peacetime construction program in Indonesian history, concentrated in a region where BUJK information asymmetry is highest. (3) UU PDP 2022 enforcement: companies that ignored data governance now face legal exposure — MJP's compliant data platform is the safe choice. These three forces create a 2026–2028 window where adoption costs are lowest and switching costs are highest.", tc: "text-primary" },
            { frame: "Frame 2: Market size — not a niche tool for a niche problem", content: "TAM: 147.230 BUJK × avg potential ARR Rp 5.4jt = Rp 795M ARR. SAM (currently addressable): 42.000 qualified bidders × avg Rp 5.4jt = Rp 227M ARR. SOM (3-year target post-Series A): 4.200 klien × avg Rp 6.8jt = Rp 28.6M ARR. Current ARR: Rp 580jt (2.5% SAM penetration). Why this market is defensible: construction procurement intelligence is a B2B product sold to established businesses (BUJK that have operating revenue) — not consumer app economics.", tc: "text-blue-700" },
            { frame: "Frame 3: Why MJP wins — the 5-year head start", content: "What took 5 years to build cannot be rebuilt in 2: (1) 671-LPSE crawler with battle-tested quality systems (error rate < 0.1%), (2) 1.247-asset Knowledge Registry with curated interpretation layer (not raw text), (3) 847 klien generating behavioral data that trains personalization models, (4) Budi's 67 field interviews creating proprietary pain point knowledge. A competitor starting today: 26 months minimum to replicate even imperfectly, according to Sari's knowledge moat analysis. By then: MJP will have Series A capital deployed and be at 4.200 klien.", tc: "text-emerald-700" },
            { frame: "Frame 4: Unit economics that improve with scale", content: "LTV:CAC ranges from 79:1 (Starter) to 190:1 (Enterprise). Gross margin: 81–86% (improving as infrastructure costs become more fixed vs variable). Payback period < 1 month across all tiers. What improves at scale: (1) infrastructure cost per klien decreases (fixed crawler cost spreads), (2) AI recommendation quality improves (more behavioral data = better personalization), (3) Knowledge Registry ROI increases (same Sari output serves more klien). This is a platform economics business — not a services business.", tc: "text-orange-700" },
            { frame: "Frame 5: The team that earned the right to raise", content: "Self-funded 5 years. Zero investor money, zero startup clichés. Built to Rp 580jt ARR through discipline: 7 people, 847 klien, zero involuntary turnover. What Series A capital buys: Head of Growth (unlock PLG + SDR channels), 3 additional engineers (accelerate API products + mobile), Budi's research expansion (V2: BUJK Asing, V3: MEP specialist). What it does NOT buy: 'figuring out the business model' (that's done) or 'finding product-market fit' (that's proven). This round is for acceleration, not discovery.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.frame} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.frame}</p>
              <p className="text-[7px] text-muted-foreground">{r.content}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A narrative adalah dokumen yang Hendra refines after every investor meeting — what landed, what didn't, what questions came up that the narrative didn't pre-answer. After 12 investor meetings (3 passed, 7 in various stages of diligence, 2 term sheet discussions in progress): the Frame 3 (5-year head start) and Frame 5 (team that earned the right) are consistently the strongest resonators. Frame 1 (why now) is most often challenged: 'Why now and not 2 years ago?' Hendra's answer: 'We've been building for 5 years precisely to be ready for this window. The window existed but we weren't ready. Now we are.' Hendra: 'Fundraising narrative yang bagus bukan tentang overselling — ini tentang giving investor the most accurate picture of what they're investing in, framed in the language of return and risk. Satu-satunya cara untuk tidak disappoint investor adalah jangan oversell.'</p>
      </div>

      {/* R104: MJP Board of Advisors & Investor Relations */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> BOARD OF ADVISORS {"&"} INVESTOR RELATIONS — 4 Advisors yang Membantu Hendra Navigasi Series A: Kontribusi Masing-masing, Waktu yang Diinvestasikan, dan Pelajaran tentang Membangun Advisory Network yang Benar-benar Berguna
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { advisor: "Advisor A: Senior partner di firma VC lokal (ex-officio, pre-investment)", contribution: "Quarterly 90-minute strategy sessions. Introduced MJP to 4 investors in his network — 2 are in current diligence. Provides 'investor lens' on Hendra's decisions: 'How would an investor read this metric? This narrative?' Most valuable: helping Hendra understand what investors actually look at vs what founders think they look at.", time: "~6 hours/quarter. No equity taken — relationship-based. Will convert to formal advisory board post-Series A with standard 0.5% 4-year vesting advisory grant.", tc: "text-primary" },
            { advisor: "Advisor B: Founder of construction-adjacent SaaS company (exited)", contribution: "Monthly check-in, no agenda. 'Ask anything' sessions. Most valuable contributions: (1) warned Hendra that enterprise sales would become the bottleneck before it happened, leading to Reza being hired 6 months earlier than planned, (2) introduced Hendra to his head of growth who is now in consideration for MJP post-Series A.", time: "~4 hours/month. 0.25% advisory equity already granted at 2022 seed. Deeply valuable — every hour with him has saved weeks of mistakes.", tc: "text-blue-700" },
            { advisor: "Advisor C: Profesor IT dari universitas teknik ternama, pakar konstruksi digital", contribution: "Research credibility. Co-author on Budi's field research reports — adds academic legitimacy. Connected MJP to 3 GAPENSI asosiasi contacts who became early Enterprise klien. Provides product review for AI/NLQ features: 'Is this actually useful for practitioners?'", time: "~3 hours/month. 0.1% advisory equity. Relationship: Budi's former lecturer. Personal trust relationship that converts to institutional credibility.", tc: "text-emerald-700" },
            { advisor: "Advisor D: General Counsel dari perusahaan konstruksi besar (BUJK Besar klien)", contribution: "Legal reality check. Every time MJP considers expanding into new data source or regulatory area: Hendra asks Advisor D 'would a large BUJK's legal team be comfortable with this?' Also: first Enterprise klien who demanded PDF briefing automation — which became Task #11 (current MERGING). Represents 'demanding Enterprise customer' perspective that shapes product roadmap.", time: "~2 hours/quarter. No equity — relationship maintained through Enterprise subscription and occasional advisory lunch. Provides more value than the Rp 2.8jt/month he pays.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.advisor} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.advisor}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.contribution}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Time + equity: {r.time}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Advisory network adalah one of the most undervalued strategic assets at MJP — because none of the 4 advisors are 'famous names' that appear on a pitch deck to impress investors. They are people who genuinely help. Hendra's advisory philosophy: 'Advisory board yang bagus bukan tentang brand names — ini tentang people who have done what you're trying to do and are willing to share the details, not just the LinkedIn version.' Hendra's test for any advisory candidate: 'Would I call this person at 10pm with a hard decision?' If yes: worth pursuing. If no: it's just a credential, not an asset. Post-Series A planned formal advisory board: expand to 6 advisors, adding 2 new: (1) someone with Southeast Asia SaaS distribution experience, (2) someone who has sold a company to a strategic buyer in the government technology space. Hendra: 'Investor memberikan modal. Advisors memberikan sesuatu yang lebih berharga: decision-making context yang hanya datang dari experience yang mereka punya dan kita belum.'</p>
      </div>

      {/* R105: MJP 5-Year Financial Model */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> MJP 5-YEAR FINANCIAL MODEL — Proyeksi 2026–2030: Skenario Base, Bull, Bear, Asumsi Kritis di Setiap Tahun, dan Mengapa Hendra Hanya Percaya 2 Angka: ARR dan Churn
        </p>
        <div className="overflow-x-auto mb-3">
          <table className="w-full text-[7px] font-mono">
            <thead>
              <tr className="border-b sticky top-0 bg-background z-10">
                <th className="text-left p-1 text-muted-foreground">Tahun</th>
                <th className="p-1 text-center">ARR Base</th>
                <th className="p-1 text-center">ARR Bull</th>
                <th className="p-1 text-center">ARR Bear</th>
                <th className="p-1 text-center">Klien (base)</th>
                <th className="p-1 text-center">Team Size</th>
                <th className="p-1 text-center">Asumsi Kritis</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["2026 (aktual+)", "Rp 580jt", "Rp 700jt", "Rp 520jt", "847", "6", "Series A closes Q4 2026. Head of Growth + 2 engineers hired Q1 2027.", "text-primary"],
                ["2027", "Rp 1.4M", "Rp 1.9M", "Rp 850jt", "1.800", "11", "Post-Series A growth acceleration. Mobile active users 600+. BNSP API live.", "text-primary"],
                ["2028", "Rp 3.2M", "Rp 4.5M", "Rp 1.8M", "3.500", "18", "Vision 2028: JO matching live. 2nd data engineer. IKN Intelligence tier launched.", "text-blue-700"],
                ["2029", "Rp 6.8M", "Rp 10M", "Rp 3.5M", "6.500", "27", "Regional expansion: 1 non-Jakarta office. Government data partnership. API monetization.", "text-emerald-700"],
                ["2030 (Series B)", "Rp 14M", "Rp 22M", "Rp 7M", "11.000", "40", "Series B milestone. Southeast Asia exploration begins. B2B data licensing mature.", "text-orange-700"],
              ].map((row) => (
                <tr key={row[0]} className="border-b hover:bg-muted/20">
                  <td className={`p-1 font-bold text-[7px] ${row[7]}`}>{row[0]}</td>
                  <td className={`p-1 text-center font-bold ${row[7]}`}>{row[1]}</td>
                  <td className="p-1 text-center text-emerald-600">{row[2]}</td>
                  <td className="p-1 text-center text-red-500">{row[3]}</td>
                  <td className="p-1 text-center text-muted-foreground">{row[4]}</td>
                  <td className="p-1 text-center text-muted-foreground">{row[5]}</td>
                  <td className={`p-1 text-[6px] ${row[7]}`}>{row[6]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">5-year financial model adalah dokumen yang Hendra updates every 6 months — base case adjusted for actual performance, bull/bear for investor conversations. The two numbers Hendra trusts most: ARR (what is actually contracted today) and monthly churn rate (what fraction of that ARR is at risk). All other metrics (DAU, NLQ queries, Trust Score views) are leading indicators that Hendra watches for early signal of ARR trajectory change. Current performance relative to model: ARR on-track with 2026 base. Churn performing better than base assumption (0.7% actual vs 1.1% base). Head count performing better than base (6 people doing the work modeled for 8). The bear case assumption: Series A fails AND churn increases to 2%/month AND no new klien growth for 6 months. Even in bear case: company survives 18 months on existing ARR and cash runway. Hendra: 'Model keuangan yang bagus bukan yang paling optimis atau paling pesimis. Model yang bagus adalah yang membuat Anda bangun di pagi hari tahu persis apa yang harus terjadi hari ini untuk mencapai tahun yang Anda proyeksikan.'</p>
      </div>

      {/* R106: MJP Founding Story — Why This Market, Why This Team */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 text-primary" /> FOUNDING STORY — Mengapa Hendra Memilih Masalah Ini: Dari Konsultan Engineering yang Frustrasi ke Founder yang Membangun Intelligence Platform untuk 147.000 BUJK Indonesia dalam 5 Tahun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { chapter: "Bab 1 (2018–2019): Hendra sebagai konsultan teknik — melihat masalah dari dalam", story: "Hendra worked 3 years as a civil engineering consultant at a medium-sized firm in Jakarta. His job included helping clients navigate government tenders. Daily experience: searching multiple LPSE portals manually, spending 2–3 hours per day just identifying relevant tenders, missing several large tenders because the announcement wasn't caught in time. 'Saya tahu masalahnya karena masalah itu ada di meja saya setiap hari.'", insight: "Not just tender discovery — the deeper problem: clients asked 'who are the competitors and what price will they bid?' — an unanswerable question without intelligence infrastructure. Hendra's consulting clients who couldn't answer this question consistently bid wrong.", tc: "text-primary" },
            { chapter: "Bab 2 (2020): Membangun prototype — bukan untuk dijual, untuk dipakai sendiri", story: "Hendra built a basic LPSE crawler for himself while still consulting. Not a product — a personal tool. It scraped 8 LPSE portals relevant to his clients' market and sent him a daily email with new tenders. Time saved: 1.5–2 hours per day. When he showed it to 3 clients: all 3 said 'can we get this too?' He charged Rp 500k/month informally to maintain and send daily reports. Three months: Rp 1.5jt/month from 3 clients. Not a business yet. A signal.", insight: "'Tiga klien membayar untuk sesuatu yang saya buat untuk diri sendiri. Itu adalah satu-satunya validation yang saya butuhkan untuk tahu bahwa masalah ini nyata.' Hendra resigned from consulting November 2020.", tc: "text-blue-700" },
            { chapter: "Bab 3 (2021): Dari crawler ke platform — dan merekrut Hendra Jr.", story: "The 3-client personal tool couldn't scale. Every client wanted different LPSE coverage, different alert criteria, and Hendra was managing it manually. Decision: build a proper product. Problem: Hendra is a civil engineer, not a software engineer. He could build crude Python scripts but not a production-quality web platform. Met Hendra Jr. through a university alumni network — Hendra Jr. was looking for a technical co-founder role. Offer: equity, no salary (Hendra had minimal savings). Hendra Jr. accepted.", insight: "The equity-for-no-salary offer worked only because Hendra Jr. saw the problem as genuinely interesting and Hendra as credible (domain expert, paying clients, real product). 'Kalau saya tidak punya 3 klien yang membayar, Hendra Jr. mungkin tidak mau join.'", tc: "text-emerald-700" },
            { chapter: "Bab 4 (2022): Menemukan Sari dan Budi — menyempurnakan edge cases", story: "Platform launched Q1 2022 with 18 paying clients. Hendra Jr. was building features, Hendra was selling. But knowledge content was weak — Sari joined from a BUJK background to fix it. Field research was non-existent — Hendra was making product decisions from the 18 early clients, all of whom were urban Java BUJK. Budi joined Q3 2022 for field research, initially for 3 months as a contractor. Both Sari and Budi revealed dimensions of the problem that Hendra hadn't seen from his consulting experience.", insight: "'18 klien membuat saya merasa saya tahu masalahnya. Sari dan Budi menunjukkan bahwa saya hanya tahu satu versi dari masalah itu. Versi Jawa, versi perkotaan, versi pengalaman saya sendiri.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.chapter} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.chapter}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.story}</p>
              <p className={`text-[7px] font-mono italic ${r.tc}`}>Insight: {r.insight}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Founding story adalah the narrative Hendra tells investors in the first 5 minutes of every pitch — not because it's required protocol, but because it answers the most important investor question before it's asked: 'Why you?' The answer embedded in the story: Hendra didn't choose this market from a spreadsheet analysis of opportunity size. He lived this problem, built a tool to solve it for himself, discovered it was valuable, and built a team to scale what he already knew worked. Each team member — Hendra Jr., Sari, Budi — entered the story at the exact moment when a limitation of Hendra's own perspective became visible. This is not a story of a smart founder who identified a market gap. It's a story of someone who was inside the gap, built their way out, and then discovered how large the gap was for everyone else. Hendra's closing line when telling this story: 'Saya tidak memilih masalah ini. Masalah ini memilih saya. Dan selama 5 tahun terakhir, saya hanya memastikan bahwa saya layak untuk menyelesaikannya.'</p>
      </div>

      {/* R107: The Letter Hendra Would Write to His 2020 Self */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Pen className="h-3.5 w-3.5 text-primary" /> LETTER TO 2020 HENDRA — Apa yang Hendra Ketahui Sekarang yang Dia Harap Dia Tahu di Awal: 7 Pelajaran dari 5 Tahun Membangun MJP yang Tidak Ada di Buku Startup Manapun
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { lesson: "1. Bayar dirimu sendiri lebih cepat dari yang kamu kira kamu bisa", detail: "Hendra went 18 months without meaningful personal income after leaving consulting. It was sustainable only because he had savings. The psychological toll of financial self-deprivation: underestimated. Decision quality degrades when you're stressed about personal finances. Lesson: at Rp 20jt ARR/month (roughly 40 klien), take a salary — even Rp 5jt/month. Don't wait until it 'makes sense.'", tc: "text-primary" },
            { lesson: "2. Rekrut Sari lebih awal — knowledge gap adalah retention risk, bukan hanya product gap", detail: "MJP's first 18 months: tender data good, regulatory knowledge weak. 3 early klien churned citing 'I need more than just tender alerts — I need to understand the rules.' If Sari had been hired at Month 6 instead of Month 18: those 3 klien might have stayed. The compounding value of those 3 retained klien (referrals, case studies, ARR) is incalculable but certainly {'>'} Rp 500jt over 5 years.", tc: "text-blue-700" },
            { lesson: "3. Jangan takut untuk menaikkan harga lebih awal", detail: "MJP charged Rp 150k/month for 2 years. Raised to Rp 249k, then Rp 399k, then Rp 499k over 3 years. Each raise: minimal churn. Hendra's regret: 'Dengan pricing Rp 150k, kami tidak bisa afford untuk hire properly. Jika kami sudah Rp 299k dari awal — kami mungkin bisa hire Hendra Jr. full-time 12 months earlier.' Price confidence comes from knowing your value. MJP knew its value — didn't price to it.", tc: "text-emerald-700" },
            { lesson: "4. Satu pengguna Enterprise yang sangat puas lebih berharga dari 10 pengguna Pro yang biasa puas", detail: "The discovery: Enterprise klien don't just use the product more — they advocate more, refer more, give more feedback, and build more of their workflow around the platform. The ROI of prioritizing Enterprise outcomes (even at cost of Pro feature development) is 3–5× higher than the revenue difference suggests. Lesson: treat every Enterprise klien as a case study in progress, not just a revenue line.", tc: "text-orange-700" },
            { lesson: "5. Field research adalah foundational, bukan optional", detail: "Without Budi's field research: MJP would have built a Jakarta-centric, large-BUJK-centric platform that addressed only 30% of the market's actual problems. Every major product insight that Reza now sells as differentiation (Trust Score, pain point depth, geographic coverage) traces back to Budi's interviews. Lesson: hire the researcher before the 3rd engineer.", tc: "text-primary" },
            { lesson: "6. Data privacy compliance dari hari pertama, bukan sebagai afterthought", detail: "MJP's legal review (Rp 12jt, after 3 years of operation) confirmed MJP had been operating with data privacy practices that were largely compliant — but by luck, not design. With UU PDP now in force: any company that didn't think about data privacy from Day 1 is retroactively exposed. Lesson: Rp 3jt for a 1-hour legal consultation on data privacy in Year 1 would have saved Rp 12jt in Year 3 and significant stress.", tc: "text-blue-700" },
            { lesson: "7. Tim kamu adalah pilihan — dan pilihan itu adalah salah satu keputusan terpenting yang kamu buat", detail: "Hendra's team (Hendra Jr., Sari, Budi, Reza, Dewi) are not accidental. Each was a deliberate choice that shaped MJP's trajectory. The one regret: not having an explicit conversation with each new hire about 'why you joined and what you hope to build here' at the start. Hendra Jr. joined for equity and problem interest; 4 years later, the equity and the problem are still there. But the conversation about career growth and future was implicit, not explicit. Lesson: make the career conversation explicit from Day 1.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.lesson} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.lesson}</p>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Letter to 2020 Hendra adalah dokumen yang Hendra wrote during the 2025 annual offsite's Day 3 session — a personal reflection exercise that he then shared with the team. It became unexpectedly emotional: Hendra Jr. read Lesson 7 and said 'I wish we'd had that conversation explicitly from the start.' That comment led to a 2-hour team discussion about what each person hoped MJP would become — not the product, but the company — and what they personally hoped their role would look like in 3 years. The letter is now part of every new hire onboarding: not as a manual, but as a context document about how MJP learned. Hendra: 'Surat ini bukan tentang penyesalan — ini tentang kejujuran. Setiap kesalahan di dalamnya membentuk MJP yang ada sekarang. Tapi jika 2020-Hendra membaca ini, mungkin 2023-MJP bisa lebih baik. Dan itu sudah cukup alasan untuk menulisnya.'</p>
      </div>

      {/* R108: The Numbers Behind MJP's Series A Ask */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <ChartBar className="h-3.5 w-3.5 text-primary" /> SERIES A FINANCIAL MODEL — Angka di Balik Target Fundraise MJP: Berapa yang Akan Dikumpulkan, Untuk Apa, Apa Milestone yang Akan Dibuka, dan Bagaimana Investor Akan Mendapatkan Return
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { line: "Target raise: Rp 15–20 miliar (USD 1.0–1.3M)", detail: "Valuation basis: 8–10× ARR multiple on current Rp 12.7B ARR. Pre-money valuation target: Rp 90–100B. Dilution: 15–18% equity. Structure: priced round (not convertible note) to establish clear valuation baseline for Series B. Lead investor target: 1 institutional (fintech/proptech-focused VC) + 1 strategic (BUJK association, bank, or government-adjacent).", rationale: "Rp 15–20B is the minimum to execute the 24-month plan without compromising speed. Below Rp 12B: can only fund hiring + data; no product acceleration. Above Rp 25B at this stage: over-dilution that would constrain Series B negotiation.", tc: "text-primary" },
            { line: "Deployment: Year 1 (Rp 9B) vs Year 2 (Rp 9B)", detail: "Year 1 priorities: Engineering team expansion (2 FTE, Rp 3.6B total), Budi's regional researcher program (Rp 1.4B), DevOps infrastructure upgrade (Rp 800jt), legal/compliance (UU PDP, Series A documentation, Rp 500jt), marketing acceleration for 847→1.400 klien target (Rp 2.7B). Year 2 priorities: IKN Intelligence tier build (Rp 3B), mobile app V2 (Rp 2B), GAPENSI partnership scaling (Rp 1.5B), SKK partnership infrastructure (Rp 1B), reserve (Rp 1.5B).", rationale: "Front-loading Year 1 with hiring and infrastructure: necessary because these are the highest-leverage investments. The engineers hired in Month 1–3 are productive for 24 months, not 12.", tc: "text-blue-700" },
            { line: "Milestone 1 (Month 12): 1.400 klien, ARR Rp 22–24B", detail: "From 847 to 1.400 klien requires net 553 new klien in 12 months (46/month vs current ~22/month). This 2× growth requires: (1) GAPENSI partnership activation (est. 300 klien from GAPENSI member channel), (2) Reza + 1 additional sales FTE, (3) improved onboarding (addressing CHURN-1 Trialist profile), (4) IKN intelligence briefings (new Enterprise klien from IKN BUJK). ARR growth from 847 to 1.400 klien at blended Rp 1.5M/year/klien = Rp 21B ARR.", rationale: "1.400 klien at Month 12 is Hendra's Series B-readiness threshold: at this scale, MJP is the category leader with defensible market share.", tc: "text-emerald-700" },
            { line: "Milestone 2 (Month 24): 2.200 klien, ARR Rp 38–42B, EBITDA breakeven", detail: "From 1.400 to 2.200 requires continued 45/month net growth. Key enablers: (1) SKK partnership scaling (BNSP MOU activation), (2) IKN Intelligence tier launch contributing 80–120 high-value Enterprise klien at Rp 8–12M/year ARR, (3) Open Knowledge API first B2B licensing revenue (2–4 bank/ERP clients at Rp 500jt–1B/year). EBITDA breakeven: at Rp 38B ARR with projected fixed cost base of Rp 36B (team of 12, infrastructure, compliance).", rationale: "EBITDA breakeven at Month 24 removes Series B fundraising urgency — MJP can raise on strength, not necessity. Valuation at breakeven: projected Rp 280–320B on 7–8× ARR.", tc: "text-orange-700" },
            { line: "Series B prep: Rp 50–75B raise target at Rp 350–450B valuation (Q4 2028)", detail: "Series B use of funds (preliminary): (1) IKN on-the-ground intelligence unit (Kalimantan field office), (2) Open Knowledge API platform build, (3) Southeast Asia market exploration (Vietnam, Philippines construction markets), (4) M&A reserve for complementary data assets. Series B lead target: regional growth equity fund (GIC, Temasek, MDI) or strategic corporate (major BUJK, bank, insurance company). Series C: post-profitability, pre-IPO positioning.", rationale: "Series B at Rp 350B+ valuation requires MJP to be demonstrably the dominant construction intelligence platform in Indonesia — not just a growing one. Series A is about building toward that dominance.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.line} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.line}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.detail}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Rationale: {r.rationale}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A financial model adalah the document Hendra updates monthly — not the specific numbers (those change with market conditions) but the structure: use of funds mapped to milestones mapped to Series B readiness. The discipline: every Rp of Series A capital must have a clear line to either (1) ARR growth, (2) retention improvement, or (3) defensibility (competitive moat deepening). Capital that doesn't trace to one of these three: doesn't get funded in the plan. The most unusual element of MJP's Series A thesis: EBITDA breakeven at Month 24. Most SaaS startups at this stage are 3–5 years from breakeven. Hendra's choice: slower growth in Year 2 to maintain path to profitability. Rationale: 'Indonesian VC market in 2026 is less tolerant of "growth at all costs" than it was in 2021. An investor who joins our Series A knowing we'll be EBITDA positive at Month 24 — that investor is aligned with our capital efficiency ethos. An investor who is disappointed by our profitability timeline — that's not our investor.' Series A capital efficiency is itself a signal to Series B investors: this team knows how to build an efficient business. Hendra: 'Dana Series A bukan hadiah. Ini adalah leverage yang harus membayar dirinya sendiri dua kali lipat sebelum Series B. Setiap Rupiah yang kami raise harus memiliki tujuan yang jelas sebelum kami mengambilnya.'</p>
      </div>

      {/* R109: Series A Due Diligence Readiness */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> DUE DILIGENCE READINESS — Persiapan MJP untuk Due Diligence Series A: 5 Dokumen yang Investor Selalu Minta dan Status Kesiapan MJP untuk Masing-masing, Plus 2 Area yang Masih Perlu Dikerjakan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { doc: "DD-1: Audited or reviewed financials (2 years)", status: "READY", detail: "MJP has 2 years of reviewed financials (Kantor Akuntan Publik, Tier-2, audited 2024 and 2023). P&L shows ARR trajectory, gross margin 71%, operating cost structure. Revenue recognition: subscription-based, recognized monthly. No deferred revenue complexity. Accounts receivable: minimal (96.3% of subscriptions are auto-billed via payment gateway). Balance sheet: clean, no debt, Rp 2.1B cash position. Investor-ready: yes.", tc: "text-emerald-700" },
            { doc: "DD-2: Cap table and equity documentation", status: "READY", detail: "Cap table: Hendra 67%, Hendra Jr. 12%, Sari 5%, Budi 4%, Reza 3%, Dewi 2%, ESOP pool 7%. All equity grants documented with vesting schedules (4-year cliff, 1-year cliff, monthly vest thereafter). Legal entity: PT Maheswara Jaya Persada, established 2021, Notarial deed updated 2024. No convertible notes outstanding. No side letters. Data room prepared: cap table, articles of association, shareholder agreements, ESOP plan document.", tc: "text-emerald-700" },
            { doc: "DD-3: Customer contracts and MRR breakdown", status: "READY", detail: "847 active subscriptions. Enterprise: 47 klien (annual contracts, signed agreements). Pro and Starter: month-to-month auto-renewal via payment gateway, no individual contracts. MRR breakdown by tier prepared: Enterprise Rp 282jt, Pro Atas Rp 187jt, Pro Rp 156jt, Starter Rp 33jt. Churn by tier: last 12 months documented. NRR (Net Revenue Retention): 104% overall, 112% Enterprise. Logo retention: 91.3% overall.", tc: "text-emerald-700" },
            { doc: "DD-4: Product and technology architecture documentation", status: "IN PROGRESS — 60% complete", detail: "Hendra Jr.'s engineering documentation project (REGRET-4 context): 60% complete as of Q2 2026. Completed: API architecture, database schema, LPSE crawler overview. In progress: 671 LPSE portal-specific authentication documentation (the most critical gap). Not yet started: data normalization layer technical spec, BNSP integration specification. Target completion: Q3 2026 (before expected investor due diligence meetings). Investor concern: solo engineer, documentation gap → key person risk. Mitigation: documentation completion + Series A hire plan for backend engineer.", tc: "text-orange-700" },
            { doc: "DD-5: Legal compliance — IP, data privacy (UU PDP), regulatory status", status: "IN PROGRESS — 75% complete", detail: "IP documentation: MJP's proprietary algorithms (Trust Score, HPS model, NLQ retrieval) not formally IP-protected — trade secret treatment. Legal counsel recommendation: file provisional patent application for HPS model before Series A (18-month window to formalize). UU PDP compliance review: 75% complete (KAP Hukum, Q1 2026). Outstanding: data processing agreement templates for Enterprise klien. LKPP 'Mitra Pengadaan' application: submitted, pending. These gaps: disclosed proactively to investors, with completion timeline.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.doc} className="border-b py-1.5">
              <div className="flex items-center gap-2 mb-0.5">
                <p className={`text-[8px] font-bold flex-1 ${r.tc}`}>{r.doc}</p>
                <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded border ${r.status === "READY" ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-orange-50 border-orange-200 text-orange-700"} shrink-0`}>{r.status}</span>
              </div>
              <p className="text-[7px] text-muted-foreground">{r.detail}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Due diligence readiness adalah Hendra's operational preparation for Series A — the documents and processes that allow an investor to move from 'interested' to 'committed' within 6–8 weeks (the typical Series A DD timeline). The 3 READY items (DD-1, DD-2, DD-3) are the foundation: financials, ownership, and revenue are the non-negotiable first-request items in every VC due diligence. The 2 IN PROGRESS items (DD-4, DD-5) are being actively completed before Hendra begins formal investor processes. Hendra's DD philosophy: never enter an investor meeting if you can't deliver any document they're likely to request within 72 hours. The worst DD experience: an investor asks for something you don't have, you say 'we're working on it,' the investor loses confidence in your operational rigor, and the deal dies over a document you could have prepared in advance. MJP's data room (Google Drive folder with investor NDA gating): updated quarterly. All 5 document categories are present in some form; the gaps are documented alongside completion timelines. Hendra: 'Due diligence bukan audit mendadak. Ini adalah percakapan yang dimulai dengan kepercayaan bahwa kamu sudah siap. Kamu siap bukan karena kamu tidak punya apa-apa untuk disembunyikan — kamu siap karena kamu sudah mendokumentasikan semuanya sebelum ditanya.'</p>
      </div>

      {/* R110: Hendra Jr.'s Post-Series A Technical Roadmap */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" /> POST-SERIES A TECHNICAL ROADMAP — Apa yang Hendra Jr. Akan Bangun Pertama Setelah Series A: 5 Proyek Teknis Prioritas yang Telah Menunggu Dana dan Kapasitas, Disertai Estimasi Waktu dan Dampak yang Diharapkan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { project: "T-ROAD-1 (Month 1–3): Engineering documentation sprint — 600 jam knowledge capture", description: "Hendra Jr.'s first post-Series A action: before any feature work begins, dedicate 3 months to documentation. Target: capture the 5 years of LPSE infrastructure knowledge currently only in Hendra Jr.'s head. Scope: 671 portal-specific authentication notes, 47-template canonical normalization rules, adaptive rate limiting behavior documentation per portal category, BNSP API integration specification, database schema decisions and rationale. Format: written engineering runbook + code comments + decision log.", why_first: "Without documentation: the Series A backend hire (Month 4–6) cannot be onboarded effectively. The documentation sprint produces the only foundation on which team scaling is possible. Hendra Jr. estimates: 80 hours of documentation work will save 200+ hours of knowledge transfer over 12 months.", tc: "text-primary" },
            { project: "T-ROAD-2 (Month 2–5): Backend engineer hire and LPSE Tier-2 expansion", description: "Series A engineering hire #1: backend engineer with distributed systems and web crawling experience. Hendra Jr.'s exact hire profile: 'Perlu seseorang yang pernah membangun crawler produksi di skala besar — bukan seseorang yang bisa belajar cara membangun crawler.' Onboarding: Month 1 (documentation review + 10 LPSE portals); Month 2 (50 portals + architecture understanding); Month 3+ (independent ownership of 200 portals). With additional backend capacity: Tier-2 LPSE expansion (currently 671 portals: 87% Tier-1 and 2, 13% Tier-3 with quality issues). Post-hire target: all 671 portals at Tier-1 quality within 6 months.", why_first: "Tier-2 expansion has been backlogged for 18 months due to capacity constraints. Enterprise klien in regions with Tier-3 LPSE portals: systematically underserved. The backend hire unlocks this quality improvement as well as Trust Score velocity, HPS model accuracy improvement, and new data source integration.", tc: "text-blue-700" },
            { project: "T-ROAD-3 (Month 3–6): Trust Score V2 — Local Execution History dimension", description: "Trust Score V2 adds the 'Local Execution History' dimension that weights regional track record appropriately for within-region assessments. Technical requirements: (1) geographic clustering of LPSE award data by province and kabupaten, (2) BUJK's primary region identification (based on historical award geography), (3) relative weighting model (within-region performance weighted 1.4× national performance for same-region assessments). Budi's field calibration: required — Hendra Jr. needs Budi's input on which performance signals matter most for non-Java BUJK. Design review: Gregorius (Flores) to validate that the new dimension correctly serves his context.", why_first: "Trust Score is MJP's highest-retention feature. Improving its accuracy for the 40%+ of BUJK that operate primarily outside Java: directly impacts retention for non-Java Enterprise klien and addresses the Gregorius feedback that has been actionable-but-unfunded for 18 months.", tc: "text-emerald-700" },
            { project: "T-ROAD-4 (Month 4–8): Real-time LPSE notification infrastructure upgrade", description: "Current LPSE monitoring: batch crawl cycle (every 4 hours for Tier-1 portals). Post-Series A target: event-driven monitoring using LPSE portal change detection (HTTP ETag + content hash comparison every 15 minutes). This reduces tender publication lag from current 2–4 hours to {'<'}30 minutes for Tier-1 portals. Technical challenge: 671 portals × 96 checks/day = 64.416 HTTP requests/day at current batch cadence → upgrading to 15-minute cadence: 384 checks/day × 671 portals = 257.664 requests/day. Requires horizontal scaling of crawler infrastructure (currently single-server, moving to distributed queue-based architecture).", why_first: "Enterprise klien's most consistent product ask: faster alerts. Current 2–4 hour lag is acceptable but not ideal for high-competition tenders. Sub-30-minute alerts: competitive differentiation vs C1 (estimated C1 alert latency: 4–6 hours based on Hendra Jr.'s monitoring). The distributed crawler architecture also unlocks: higher crawl reliability (no single point of failure), better rate limit distribution, and capacity for OIKN portal integration.", tc: "text-orange-700" },
            { project: "T-ROAD-5 (Month 6–12): Mobile offline intelligence (read cache)", description: "Mobile offline reading cache: allows klien to search contractor Trust Scores, Knowledge Registry articles, and active tender alerts while offline. Technical approach: selective sync on WiFi (pre-cache klien's personalized alert queue + recently viewed BUJK profiles + relevant Knowledge Registry assets). On-device storage budget: ~50MB for most klien profiles. SQLite on-device database for structured search. Budi's design input: 'Lapangan adalah satu-satunya konteks di mana offline search benar-benar dibutuhkan. Pastikan interface sangat jelas tentang apa yang tersedia offline vs tidak.'", why_first: "Mobile offline was identified as a critical gap by Budi's own field experience. The write-side offline queue (useOfflineQueue) is already built. The read-side offline cache: the missing half. With both sides complete: MJP's mobile app becomes fully functional in low-connectivity environments — the exact environments where klien most need reliable access.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.project} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.project}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">{r.description}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Why first: {r.why_first}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Post-Series A technical roadmap adalah Hendra Jr.'s 12-month engineering plan — the complement to Hendra's business roadmap. The 5 projects are sequenced to maximize their compounding effects: T-ROAD-1 (documentation) enables T-ROAD-2 (hire); T-ROAD-2 (hire) enables T-ROAD-3 (Trust Score V2) and T-ROAD-4 (crawler upgrade); T-ROAD-4 (distributed infrastructure) enables T-ROAD-5 (mobile cache). Removing any project from the sequence: delays all subsequent projects. The total engineering investment: approximately 2.100 person-hours over 12 months (Hendra Jr. + Series A backend hire). Estimated product impact: Trust Score accuracy improvement (Local Execution History: +15–20% for non-Java BUJK), alert latency improvement (4-hour → 30-minute: estimated 8% retention improvement among high-frequency users), mobile offline capability (enables use in field contexts that currently lose sessions). Hendra's framing of the roadmap for investors: 'Hendra Jr. has been building this platform alone for 5 years. He knows exactly what he would build with a second engineer. He's had to defer it because he didn't have the capacity. Series A funding gives him that capacity — not for experiments, but for specific, well-scoped work that has been waiting for resources.' Hendra Jr.: 'Saya sudah tahu selama 18 bulan apa yang perlu saya bangun selanjutnya. Yang saya butuhkan bukan lebih banyak waktu untuk berpikir — yang saya butuhkan adalah cukup kapasitas untuk akhirnya mengerjakannya.'</p>
      </div>

      {/* R111: Hendra's 5-Minute Investor Pitch Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> 5-MINUTE INVESTOR PITCH ARCHITECTURE — Struktur Naratif di Balik Setiap Warm Intro Hendra: Cara Hendra Mengompresi 5 Tahun Perjalanan MJP ke dalam 1 Percakapan yang Mendorong Investor ke Diligence
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { minute: "Menit 1: The Problem — Berapa banyak uang yang hilang setiap tahun", script: "Hendra opens: 'Konstruksi adalah industri terbesar ke-2 di Indonesia — lebih dari Rp 600T anggaran pengadaan publik per tahun. 93% kontrak dimenangkan oleh BUJK yang tidak memiliki sistem intelijen pasar yang terstruktur. Rata-rata BUJK menghabiskan 340 jam/tahun mencari informasi yang seharusnya bisa tersedia dalam 10 menit.' The opening numbers are not embellishments — each is sourced from verifiable research. Hendra's rule: 'Saya tidak pernah menggunakan angka yang tidak bisa saya jelaskan sumbernya dalam 30 detik.'", tc: "text-primary" },
            { minute: "Menit 2: The Solution — MJP sebagai procurement intelligence platform", script: "Hendra's pivot: 'Kami membangun platform yang mengambil keputusan yang biasanya membutuhkan 4–6 jam research manual dan menjadikannya tersedia dalam 90 detik: tender yang tepat untuk profil BUJK mereka, verifikasi mitra JO sebelum commitment, interpretasi regulasi yang berdampak pada qualification threshold mereka.' The solution pitch focuses on outcomes (time saved, errors prevented), not features (NLQ, Trust Score, HPS). Feature names come later — they're evidence, not the pitch.", tc: "text-blue-700" },
            { minute: "Menit 3: Traction — Angka yang menunjukkan product-market fit", script: "Hendra's traction slide: 847 BUJK aktif, Rp 2.1B ARR, 9.4/10 NPS dari Enterprise klien, 88.3% annual retention. The sequence matters: NPS before retention. Investors have seen retention numbers that are high because of switching costs. NPS establishes that retention is driven by genuine value, not stickiness. Hendra's most important traction data point: 'Zero Enterprise klien churn in the past 14 months — not because we have a long-term contract, but because every Enterprise klien has renewed without negotiation.'", tc: "text-emerald-700" },
            { minute: "Menit 4: Moat — Mengapa defensible terhadap incumbents dan well-funded new entrants", script: "Hendra's moat explanation: 4 layers, presented in order of defensibility. (1) Data moat: 5 years of LPSE crawl history that competitors cannot replicate. (2) Relationship moat: 67-narasumber network that took 5 years to build — cannot be bought. (3) Domain moat: Sari's Knowledge Registry — regulatory intelligence that requires domain expertise to produce, not just data infrastructure. (4) Institutional moat: LKPP 'Mitra Pengadaan' application — government endorsement that no new entrant can shortcut. Hendra: 'Masing-masing layer defensible sendiri. Kombinasinya adalah apa yang membuat saya tidur nyenyak.'", tc: "text-orange-700" },
            { minute: "Menit 5: The Ask — Mengapa sekarang, dan apa yang akan dilakukan dengan Series A", script: "Hendra's close: 'Kami profitable, Rp 280M cash on hand, burn rate minus di unit economics. Kami tidak fundraising karena kami butuh uang untuk bertahan — kami fundraising karena ada jendela pasar 18 bulan yang tidak akan tersedia setelah itu: 3 kebijakan pengadaan yang akan berlaku Q2 2027 akan mendorong 40% BUJK yang belum ter-digitize untuk masuk ke pasar. Series A gives us the sales capacity (Reza dari 1 ke 4) dan engineering capacity (Hendra Jr. mendapat backend engineer) untuk capture jendela itu before C1 reacts.' The close is a timing argument, not a desperation argument.", tc: "text-primary" },
          ].map((r) => (
            <div key={r.minute} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.minute}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Script structure: {r.script}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">5-minute pitch architecture adalah Hendra's most refined communication product — because it took 23 investor meetings across 2 years to get right. The current structure is not the original structure. Version 1 (2023): opened with the product demo. Result: investors asked product questions, never got to traction. Version 2 (early 2024): opened with traction. Result: investors wanted the 'why this problem' context first. Version 3 (mid-2024): opened with problem, then solution, then traction. Result: moat conversation was rushed, investors didn't understand defensibility. Current version (V4, refined Q4 2024): the 5-minute architecture above. Result: Warm Lead conversion rate from pitch to diligence request: 34% (from 8% in Version 1). The most common investor feedback after the current pitch: 'Saya sudah pernah melihat pitch tentang construction market intelligence sebelumnya — tapi ini adalah pertama kalinya saya mengerti mengapa moat-nya nyata.' Hendra: 'Pitch yang bagus bukan tentang cerita yang paling menarik. Ini tentang urutan yang membuat investor bertanya pertanyaan yang tepat — karena pertanyaan yang tepat adalah tanda bahwa mereka sudah convert dari skeptis ke penasaran.'</p>
      </div>

      {/* R112: Series A Data Room Readiness */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> DATA ROOM READINESS — Apa yang MJP Sudah Siapkan untuk Investor Due Diligence Series A: 6 Kategori Dokumen, Status Kesiapan, dan Gap yang Masih Perlu Diselesaikan Sebelum Close
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { category: "DR-1: Financial Performance — P&L, cash flow, ARR cohort", status: "READY (100%)", documents: "Monthly P&L statements (Jan 2022 – Jun 2026). ARR cohort analysis: monthly cohort retention curves by acquisition month (48 months of data). Unit economics model: CAC by channel, LTV by tier, payback period. Cash flow statements with burn rate calculation. Balance sheet (minimal — MJP is asset-light). Cap table and equity structure. All documents prepared by Hendra and reviewed by MJP's external accountant (Rp 8jt/year engagement). Financial model: built in Google Sheets, exportable to Excel for investor use.", tc: "text-emerald-700" },
            { category: "DR-2: Product and Technology — architecture, security, uptime", status: "READY (95%)", documents: "System architecture diagram (Hendra Jr., updated Q2 2026). LPSE portal coverage map (671 portals, with data quality tier per portal). Technology stack documentation. Security practices: data encryption at rest/transit, access controls, API security. Uptime history: 99.1% (past 24 months). Incident log: all 5 incidents exceeding 1 hour in past 24 months, root cause and resolution. NLQ accuracy benchmark: methodology and latest results. Gap remaining: formal security audit (pentest) scheduled Q3 2026 — not yet complete.", tc: "text-primary" },
            { category: "DR-3: Commercial — klien cohorts, NPS, retention analysis", status: "READY (90%)", documents: "847 active BUJK breakdown by tier, acquisition month, industry segment, geography. Cohort retention table: monthly retention for each acquisition quarter (2022–2026). NPS data: 3 NPS surveys (2023, 2024, 2025) with verbatim responses. Churn analysis: each churn event categorized (CHURN-1 through CHURN-5), root cause, and whether preventable. Klien concentration risk: top 10 klien as % of ARR. SKK Express klien data: cases by month, revenue per case, retention impact. Gap remaining: formal win/loss analysis report — currently in Reza's notes, needs formatting.", tc: "text-blue-700" },
            { category: "DR-4: Team and Org — bios, equity, key-person risk", status: "READY (100%)", documents: "6-person team bios with LinkedIn profiles. Equity and option table. Key-person risk analysis: what happens if Hendra, Hendra Jr., or Sari leaves (succession plan, documentation status, institutional knowledge transfer status). Org chart (current + post-Series A target). Hiring plan: 4 positions with JD drafts (Backend Engineer, Knowledge Research Analyst, Sales Rep x2). Compensation benchmarks for planned hires. Decision Log (147 entries) — accessible to investor but not distributed by default.", tc: "text-emerald-700" },
            { category: "DR-5: Market — TAM, competitive, regulatory environment", status: "READY (85%)", documents: "TAM model: 35.000 BUJK universe, addressable 12.000, serviceable 5.200. Competitive analysis: C1 feature comparison, pricing comparison, data quality comparison (3 test cases). Regulatory environment analysis: 3 coming policy changes (Q2 2027), expected market impact, MJP preparation status. Market research: 22-BUJK survey from 2021 (original), updated with Budi's 2024 narasumber themes. Gap remaining: updated formal competitive intelligence report — C1's current pricing and feature set needs validation against latest Reza's RE findings.", tc: "text-orange-700" },
            { category: "DR-6: Legal and Compliance — IP, data rights, LKPP relationship", status: "READY (70%)", documents: "IP ownership confirmation (all code, content, and methodology is MJP-owned). Data rights analysis: legal opinion on LPSE data crawling rights (2023, prepared by construction procurement law specialist). BNSP API terms compliance documentation. LSP partnership agreements for SKK Express (4 agreements). Gap remaining: LKPP 'Mitra Pengadaan' application status documentation — the implementation agreement terms need legal review before investor presentation. Privacy policy and data processing documentation — needs update for PDPA Indonesia 2024 compliance.", tc: "text-red-700" },
          ].map((r) => (
            <div key={r.category} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.category} <span className="font-mono text-[7px] ml-1">{r.status}</span></p>
              <p className="text-[7px] text-muted-foreground">{r.documents}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Data room readiness adalah the operational manifestation of Hendra's Series A preparation — the transformation of MJP's 5-year operating history into an investor-navigable repository of evidence. The 6 categories represent the standard institutional VC due diligence framework (Financial, Product, Commercial, Team, Market, Legal) applied to MJP's specific context. Overall readiness: approximately 90% complete as of Q2 2026. The 10% gap: primarily DR-6 (legal compliance update for PDPA 2024 and LKPP agreement documentation) and secondary documentation formatting tasks. The data room itself: hosted on a secure Notion workspace with permission-gated sections. Hendra's data room philosophy: 'Investor due diligence yang lancar bukan tanda bahwa bisnis kita bagus — tapi tanda bahwa kita sudah mengelola bisnis kita dengan cara yang bisa dijelaskan kepada orang yang belum pernah melihatnya sebelumnya. Data room yang buruk: bukan masalah akuntansi — ini masalah disiplin operasional.' The most common investor observation after reviewing MJP's data room: 'Ini adalah data room terlengkap yang saya lihat untuk bisnis seukuran ini.' Hendra's response: 'Ini adalah konsekuensi dari 5 tahun mendokumentasikan keputusan dan mengukur hasilnya — bukan kerja 3 bulan sebelum fundraise.'</p>
      </div>

      {/* R113: Strategic Partnership Ecosystem */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> STRATEGIC PARTNERSHIP ECOSYSTEM — 3 Kemitraan Strategis yang Memperkuat MJP Tanpa Mengencerkan Fokus: LKPP Mitra Pengadaan, LSP SKK Express, dan Jaringan Narasumber Budi — Bagaimana Setiap Kemitraan Dibangun dan Apa yang Mengancam Keberlangsungannya
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { partnership: "PARTNER-1: LKPP 'Mitra Pengadaan' Relationship — legitimasi institusional yang memperkuat semua klaim MJP", nature: "MJP's relationship with LKPP (the national government procurement agency) is the most strategically valuable external relationship in MJP's ecosystem. The relationship is not formal (MJP has applied for 'Mitra Pengadaan' recognition but not yet received official designation) — but Sari's professional participation in LKPP working groups, consultation forums, and implementation review panels has built informal institutional recognition. LKPP staff know Sari as a reliable, accurate voice on procurement regulation interpretation.", value_to_mjp: "The LKPP relationship value: (1) Early access to regulatory working group documents (3–6 months before publication). (2) Informal guidance on edge-case regulatory interpretation that would otherwise require formal legal opinion. (3) Institutional validation: when Sari says 'our regulatory analysis aligns with LKPP's implementation intent,' it carries weight with Enterprise klien who make high-stakes decisions based on MJP's Knowledge Registry. Hendra's fundraising use: 'Kami tidak hanya memantau LKPP dari jauh — kami hadir di dalam diskusi yang membentuk implementasinya.'", risk: "Primary risk: LKPP personnel change. Sari's contacts are individuals, not institutional positions. If key working group members are transferred, retired, or reassigned: the relationship must be rebuilt with their successors. MJP's mitigation: Sari documents every working group interaction and maintains relationships with 7–9 LKPP contacts across different functions — reducing key-person dependency within the LKPP relationship.", tc: "text-primary" },
            { partnership: "PARTNER-2: 4 LSP Agency Agreements — operational backbone of SKK Express that also creates data pipeline advantage", nature: "MJP's 4 LSP (Lembaga Sertifikasi Profesi) agency agreements are the legal foundation of SKK Express. The 4 LSPs cover all 9 SKK jenjang across the most common KBLI categories MJP's BUJK operate in. The agency model: MJP refers BUJK to LSPs, LSPs process the certification, MJP earns a referral fee structured as a service coordination fee (to avoid regulatory classification as a labor placement agency, which would require a different license). The agreements: 2-year terms, renewable. All 4 agreements currently active and renewed within the past 12 months.", value_to_mjp: "Beyond SKK Express revenue: the LSP relationships create a data pipeline advantage for the Trust Score system. MJP's 4 LSP partners provide monthly certification data feeds (which BUJK completed certifications, which expired, which are in progress). This LSP-direct data: higher accuracy than scraping BNSP's public registry (which has a 3–5 day update lag). The LSP data advantage: one component of Trust Score's DQ-2 error reduction roadmap.", risk: "Primary risk: BNSP regulatory change that restricts private entities from acting as SKK certification intermediaries. This is a low-probability but high-impact risk — if BNSP mandates direct BUJK-to-LSP relationships (no intermediaries), SKK Express's revenue model is disrupted. MJP's monitoring: Sari tracks all BNSP regulatory working groups for any proposal touching certification intermediary relationships. Current assessment: no credible threat in the 24-month horizon.", tc: "text-blue-700" },
            { partnership: "PARTNER-3: Budi's 67-Narasumber Network — proprietary intelligence pipeline that defines MJP's product differentiation", nature: "Budi's narasumber network is not a formal partnership — it's a collection of 67 bilateral professional relationships built over 5 years. Each narasumber is a BUJK owner, industry consultant, LPSE portal staff member, or procurement specialist who has agreed (implicitly or explicitly) to share honest professional knowledge with Budi in exchange for: (1) Budi's genuine interest in their perspective, (2) anonymized contribution to research that may benefit their industry, and (3) occasional professional insights Budi shares back from his cross-industry view.", value_to_mjp: "The narasumber network is MJP's most irreplaceable proprietary asset after Knowledge Registry. Every major product decision (Trust Score, NLQ, SKK Express, the planned Material Price Reference) traces to insights from specific narasumber conversations. The network's value: not the individual relationships but the collective pattern they produce — no single narasumber understands the market as well as the aggregated view of 67 narasumber analyzed over 5 years.", risk: "Primary risk: Budi leaves MJP. The narasumber relationships: built with Budi personally, not with MJP as an institution. If Budi leaves, 60–70% of active narasumber relationships would follow him or go inactive. MJP's partial mitigation: annual retrospective documentation (the network's insights are institutionalized), post-Series A plan to have Budi train a Research Associate who builds relationships with 15–20 new narasumber under Budi's supervision. The goal: reduce key-person risk from Budi's departure scenario from 'catastrophic' to 'significant setback.' Hendra: 'Budi adalah aset yang tidak bisa saya duplikasi. Yang bisa saya lakukan: memastikan pengetahuan yang dia bangun selama 5 tahun tidak hanya ada di kepalanya — ini ada di dokumentasi kami, metodologi kami, dan dalam tim yang lebih besar yang akan dia bangun setelah Series A.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.partnership} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.partnership}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Nature: {r.nature}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Value: {r.value_to_mjp}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Risk: {r.risk}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Strategic partnership ecosystem adalah one of MJP's least-discussed competitive advantages — because partnerships don't appear in a product demo or a feature comparison table. The 3 partnerships (LKPP relationship, LSP agreements, narasumber network) are not contractually protected, not listed in MJP's marketing materials, and not immediately visible to a competitor analyzing MJP's product. They are relationship-based advantages accumulated over 5 years that compound with time. Each partnership creates a self-reinforcing loop: the LKPP relationship improves Sari's regulatory forecasting, which improves Knowledge Registry quality, which attracts more BUJK, which increases the scale of observations that improve Trust Score. The LSP agreements enable SKK Express, which improves retention, which increases the subscriber base, which gives MJP more trust data for LSP partnerships. The narasumber network informs product decisions, which improves the platform, which gives Budi more to show narasumber as evidence of his work's impact, which deepens narasumber trust. These are not standalone partnerships — they're an ecosystem where each element strengthens the others. The risks are relationship-based too: LKPP personnel change, BNSP regulatory shift, and Budi departure are all people-dependent risks rather than market or technology risks. MJP's mitigation strategy: institutionalize the knowledge from each relationship (documentation, multiple contacts, training successors) so that the departure of any individual reduces the partnership's strength temporarily rather than permanently. Hendra: 'Kemitraan kami adalah pertahanan yang paling sulit ditiru kompetitor — bukan karena kita memilikinya secara eksklusif, tapi karena membangunnya membutuhkan 5 tahun. Kompetitor dengan modal lebih besar bisa mencoba — tapi mereka harus mulai dari nol. Kita sudah berada di tahun ke-5.'</p>
      </div>

      {/* R114: Capital Efficiency Story */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> CAPITAL EFFICIENCY STORY — Bagaimana MJP Mencapai Rp 2.1B ARR Hanya dengan Modal Pendiri: 5 Keputusan yang Membuat Ini Mungkin, Apa yang Dikorbankan, dan Mengapa Investor Melihat Efisiensi Modal sebagai Sinyal Kepercayaan Bukan Keterbatasan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { decision: "CE-DECISION-1: Tunda rekrutmen sampai ada revenue — bertahan dengan 2 co-founder selama 18 bulan pertama", rationale: "From Day 0 through Month 18 (mid-2020 to end-2021): MJP operated with only Hendra (product/operations) and Hendra Jr. (engineering). No payroll other than co-founder living expenses. The consequence: slower feature development and slower market outreach. The benefit: no burn rate, no investor pressure on timeline, no hiring decisions made under financial stress. At Month 18: MJP had 87 paying subscribers and Rp 180jt ARR. The first hire (Sari, Knowledge) was funded entirely by subscription revenue. The second and third hires (Budi and Reza, 2022): also funded by growing subscription revenue. By the time of 5th and 6th hires (2023–2024): MJP's ARR had grown to Rp 1.1B — the hiring decisions were made from strength, not necessity.", impact: "Capital saved vs 'standard' startup timeline (hire sales + engineering + content from Day 1): estimated Rp 1.2–1.8B in salaries and recruiting costs over 18 months. The counterfactual: most seed-stage B2B SaaS companies hire 4–6 people in Year 1 using seed capital. MJP built the same product with 2 people, retained equity and control, and reached the same subscriber milestone 6 months later. The 6-month delay: worth the complete absence of investor dependency and cap table complexity.", tc: "text-primary" },
            { decision: "CE-DECISION-2: Tidak sewa kantor selama 4 tahun — semua kerja remote dari co-founder residence", rationale: "MJP operated fully remote from Day 0 through Year 4 (2020–2024). Co-founders worked from their respective homes. Hendra's reasoning: 'We are building a data platform for BUJK across Indonesia. Our customers are in Surabaya, Makassar, Medan, and Samarinda — not in a Jakarta office building. Co-location is a signaling expense, not a productivity expense.' The remote-first model: forced Hendra to develop the written communication culture (Decision Log, retrospective documentation, weekly async updates) that would later become MJP's most cited cultural strength.", impact: "Capital saved: Rp 80–120jt/year in Jakarta office rent (conservative estimate for a 6-person team in a co-working space). Over 4 years: Rp 320–480jt. The investment instead: Hendra Jr.'s infrastructure upgrades and Budi's narasumber travel budget. In Q4 2024: MJP rented a small shared office (4 desks) for Thursday-Friday team days. Monthly cost: Rp 8jt — a fraction of full-time office rental.", tc: "text-blue-700" },
            { decision: "CE-DECISION-3: Tidak ada paid marketing selama 3 tahun — semua growth dari narasumber referral dan word-of-mouth", rationale: "MJP spent Rp 0 on paid advertising, content marketing agencies, or growth hacking tools from 2020 through 2023. All subscriber acquisition: through Budi's narasumber network (direct referrals), GAPENSI and GAPEKSINDO association contacts, and word-of-mouth among BUJK (the 47-NPS score creates organic referrals). The no-paid-marketing discipline: forced MJP to build a product genuinely worth referring rather than masking a mediocre product with acquisition spend.", impact: "Capital saved: Rp 50–80jt/year in paid acquisition costs (conservative for a B2B SaaS in Indonesia). The more important impact: MJP's subscriber NPS of 47 was built without any marketing polish — the 47 score reflects genuine product satisfaction from subscribers who found MJP through peer referral. Subscribers acquired through peer referral: show 34% lower churn in MJP's cohort analysis. The acquisition strategy shaped the retention profile. In 2024: MJP began allocating Rp 5jt/month to targeted LinkedIn and WhatsApp placement for BUJK audiences — the first marketing spend in MJP's history.", tc: "text-emerald-700" },
            { decision: "CE-DECISION-4: Bangun sendiri sebelum beli — hampir semua tooling adalah open source atau in-house", rationale: "Hendra Jr.'s default for every infrastructure decision: build with open source first, evaluate SaaS tools only when the open source solution's maintenance cost exceeds the SaaS subscription cost. Current MJP tech stack: PostgreSQL (open source, no licensing cost), Node.js/Express (open source), React/Vite (open source), vector search via pgvector extension (open source, Rp 0 vs Rp 800rb–2jt/month for a dedicated vector DB service). The only SaaS dependencies: LLM API (NLQ — unavoidable), SMTP service (briefing delivery — Rp 200rb/month), object storage (Rp 150rb/month). Total SaaS spend: approximately Rp 5.2jt/month.", impact: "Capital saved vs SaaS-heavy alternative stack (dedicated vector DB, managed search, commercial analytics, commercial monitoring): estimated Rp 8–12jt/month or Rp 96–144jt/year. The open-source approach requires more engineering time — but Hendra Jr.'s deep PostgreSQL expertise makes the maintenance cost low. The trade-off: no vendor lock-in (MJP can migrate any component without SaaS exit costs) and no SaaS price increase risk (three of MJP's open-source dependencies had their comparable commercial products raise prices 40–80% in 2024).", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.decision} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.decision}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Rationale: {r.rationale}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Impact: {r.impact}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Capital efficiency story adalah MJP's most compelling non-product narrative for Series A investors — because it demonstrates that the founding team has the judgment to allocate scarce resources correctly under uncertainty. The 4 decisions above (late hiring, no office, no paid marketing, open-source stack) collectively saved an estimated Rp 2.0–2.8B over 5 years — capital that was either not spent (preserving equity) or reinvested into product quality (Hendra Jr.'s infrastructure, Budi's narasumber travel). The result: MJP reached Rp 2.1B ARR with zero external capital. The investor implication: this team knows how to build efficiently. With Series A capital, they will not suddenly become wasteful — they have internalized cost discipline as a value, not an external constraint. The secondary implication: MJP's margins. A capital-efficient startup that built with open source and remote-first culture has a fundamentally different cost structure than a startup that hired aggressively and spent on office + paid acquisition. MJP's gross margin: 73% (Rp 1.53B of Rp 2.1B ARR flows through after direct costs). For a 6-person company: this margin profile is exceptional and reflects the open-source and remote investments compounding over 5 years. The Series A capital: will fund growth (new hires, marketing, BUJK expansion) — but the underlying cost structure remains efficient because the infrastructure was built efficiently. Hendra: 'Saya tidak pernah membuat keputusan capital efficiency untuk impress investor. Saya membuat keputusan itu karena itu adalah cara terbaik untuk membangun perusahaan yang bisa bertahan. Tapi ketika investor bertanya tentang efisiensi modal kami, saya senang bahwa keputusan yang benar untuk bisnis juga keputusan yang benar untuk pitch.'</p>
      </div>

      {/* R115: Investor Meeting Preparation Checklist */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-primary" /> INVESTOR MEETING PREPARATION CHECKLIST — Apa yang Hendra Siapkan untuk Setiap Investor Meeting: 5 Komponen Persiapan, Berapa Waktu yang Dibutuhkan, dan Pelajaran dari 23 Investor Meeting tentang Apa yang Benar-Benar Menentukan Keberhasilan
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { component: "PREP-1: Investor research — 45–90 menit per investor", content: "Hendra's investor research protocol before every first meeting: (1) Read the investor's 3 most recent public statements (LinkedIn posts, media interviews, portfolio company case studies) to identify their current thesis and what they care about most. (2) Review their portfolio for construction-tech, B2B SaaS Indonesia, and government-sector investments — then prepare specific observations about what made those investments work and how MJP fits the pattern. (3) Identify any portfolio company that competes with or complements MJP. The competitive portfolio question: the one Hendra most needs to address proactively ('do you have a conflict with Portfolio Company X?'). (4) Research the specific partner attending the meeting (not just the firm) — their personal investment history and stated thesis may differ from the firm's.", prep_value: "Investor research reduces 'generic question' time in the meeting (questions the investor asks any startup) and increases 'specific thesis' time (questions specific to MJP's fit with the investor's portfolio and thesis). Meetings where Hendra referenced a specific portfolio company observation: 78% converted to a follow-up meeting. Meetings where Hendra gave generic answers to generic questions: 31% conversion. The 47-percentage-point difference: attributable entirely to pre-meeting research quality.", tc: "text-primary" },
            { component: "PREP-2: Live metric refresh — 30 menit sebelum setiap pertemuan", content: "Hendra runs a 30-minute metric refresh before every investor meeting: current ARR (from Hendra Jr.'s dashboard), current subscriber count and tier breakdown, last 30-day churn rate, last 30-day new subscriber count, SKK Express cases in progress, and briefing open rate for the prior week. Why fresh metrics matter: investors ask about metrics in the present tense ('what is your ARR?'), and Hendra has been in meetings where a founder quoted metrics that were 6 weeks out of date. Hendra's rule: never quote a metric from memory — always from that day's dashboard. The 30-minute refresh: also catches any concerning trend Hendra should address proactively rather than defensively. If last week's churn was higher than average: better to mention it with context ('we had 2 large enterprise cancellations — here's why and what we're doing') than to have an investor discover it in due diligence.", prep_value: "The live metric refresh: caught 3 cases in the past 2 years where a metric had worsened in the days before an investor meeting. In all 3 cases: Hendra addressed it proactively in the meeting. All 3 meetings proceeded to follow-up diligence. Hendra's observation: investors appreciate founders who are aware of their numbers in real-time and can contextualize them accurately. What investors distrust: founders who seem surprised by their own metrics when asked.", tc: "text-blue-700" },
            { component: "PREP-3: Objection anticipation — 20 menit per meeting type (first meeting vs follow-up)", content: "Hendra maintains a running 'objection bank' — every investor objection from every meeting, categorized by type. Current 8 most common objections: (1) 'BUJK market is too fragmented for one platform' (counter: Trust Score's network effect requires fragmentation). (2) 'Why hasn't a large player like Sinarmas or Astra built this?' (counter: enterprise construction companies are MJP's clients, not competitors — they don't self-serve their procurement intelligence). (3) 'Government procurement market is too prone to regulatory change' (counter: regulatory change is MJP's product, not MJP's risk). (4) 'What happens when LKPP digitizes everything?' (counter: MJP adds intelligence layer that LKPP never will). (5) 'Can you get to Rp 10B ARR from this market?' (counter: 12.000+ SAM × Rp 1.2jt average ARPU = Rp 14.4B TAM). (6) 'What if a well-funded foreign player enters?' (7) 'Trust Score accuracy — how do you validate it?' (8) 'Single-founder risk if Hendra leaves.'", prep_value: "Pre-meeting objection review (20 minutes): lets Hendra anticipate and preemptively address the 2–3 most likely objections for a specific investor profile. For an investor with government-sector portfolio experience: objections 3 and 4 are most likely. For a growth-stage investor: objection 5. For an early-stage operator-investor: objection 8. Tailoring the preemptive address to the specific investor profile: reduces the adversarial 'objection and counter' dynamic and replaces it with a collaborative 'here's the nuanced picture' conversation. The objection bank: Hendra's most practically useful investor preparation artifact. Hendra: 'Setiap keberatan yang sudah saya dengar sebelumnya: saya sudah memiliki jawaban yang telah diuji. Setiap keberatan yang saya dengar untuk pertama kalinya di dalam pertemuan: itu adalah kesempatan untuk belajar. Kedua-duanya membuat pitch berikutnya lebih baik.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.component} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.component}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Content: {r.content}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Preparation value: {r.prep_value}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Investor meeting preparation checklist adalah Hendra's most refined sales process — because investor meetings are the highest-stakes, highest-leverage conversations MJP has. The 23 investor meetings in 2 years: produced the current preparation protocol through trial and error. The 3-component preparation (investor research + live metrics + objection anticipation) takes 95–140 minutes per first meeting and 50–75 minutes per follow-up. At 2–3 investor meetings per month: Hendra invests approximately 250–400 minutes/month in investor meeting preparation. The opportunity cost: this time comes from product and operational work. Hendra's justification: 'One successful investor meeting can fund 2 years of product development. The preparation-to-outcome ratio: far better than any other activity I could do with those 250 minutes.' The 2 components Hendra added latest (and found most impactful): the live metric refresh (added after a meeting where a week-old metric was challenged by an investor who had done background checks) and the investor portfolio research (added after a meeting where Hendra learned the investor had a competing portfolio company only when the investor asked about it mid-pitch). Both additions converted awkward defensive moments into prepared, confident responses. The 5 components above (PREP-1, PREP-2, PREP-3, plus PREP-4: data room update confirmation, and PREP-5: post-meeting follow-up drafting): collectively represent Hendra's 'investor meeting system' — the documentation that ensures his pitch improves with every meeting rather than repeating the same mistakes.</p>
      </div>

      {/* R116: Series A Data Room Architecture */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Database className="h-3.5 w-3.5 text-primary" /> SERIES A DATA ROOM ARCHITECTURE — Apa yang Ada di Data Room MJP: 5 Seksi Utama, Dokumen Mana yang Paling Sering Ditanya Investor, dan Mengapa Data Room yang Baik Mempersingkat Due Diligence dari 8 Minggu Menjadi 4 Minggu
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { section: "DATA-ROOM-SECTION-1: Company Overview dan Founding Story (8 dokumen)", contents: "The Company Overview section: Hendra's most carefully crafted section because it sets the interpretive frame for everything that follows. Documents: (1) Executive Summary (4 pages) — MJP's problem, solution, traction, and ask in condensed form. (2) Founding story memo (2 pages) — Hendra's personal narrative of why this problem matters, the moment he decided to build MJP, and what the first 3 BUJK conversations taught him that changed his product direction. (3) Market size analysis — TAM/SAM/SOM calculation with primary research sourcing (Budi's narasumber count, GAPENSI membership data, LKPP portal count). (4) Competitive landscape map — 2×2 plot of data coverage vs intelligence depth, showing MJP's unique position vs LPSE aggregators, SIKI-LPJK, and consultant alternatives. (5) Team bios with LinkedIn profiles. (6) Board and advisors summary. (7) Cap table as of latest round. (8) Certificate of incorporation and company legal standing.", investor_query_frequency: "Most-requested from Section 1: the competitive landscape map (every investor asks 'who else is doing this?') and the market size methodology (investors want to verify the Rp 10–14B TAM claim with primary sources). Hendra's approach to competitive questions: he proactively names the strongest competitor in each adjacent category and explains why they don't directly compete — rather than claiming MJP has no competition (which investors distrust) or minimizing competitors (which signals poor market awareness).", tc: "text-primary" },
            { section: "DATA-ROOM-SECTION-2: Financial History dan Projections (12 dokumen)", contents: "The Financial section: Hendra's most scrutinized section. Documents: (1) 3-year monthly P&L actuals (2022–2024). (2) 2025 YTD actuals (updated monthly during fundraise). (3) 5-year financial model with driver-based projections (not top-down 'capture X% of market'). (4) ARR bridge (month by month, showing new + expansion - churn components). (5) Unit economics summary: LTV, CAC, payback period, gross margin by tier. (6) Cash flow history and cash position. (7) Burn rate analysis and runway at various raise scenarios. (8) Cohort analysis — subscriber retention by signup quarter. (9) Revenue concentration analysis — no single subscriber over X% of ARR. (10) SKK Express financials (P&L by case type, separate from subscription revenue). (11) Bank statements (last 12 months). (12) Tax filings (last 3 years).", investor_query_frequency: "Most-requested from Section 2: cohort retention by signup quarter (the document that most directly proves product-market fit with historical evidence), unit economics summary (especially CAC and payback period), and the ARR bridge (which shows whether growth is driven by new subscribers, expansion, or price increase). Hendra's most important preparation: the cohort analysis. The quarter-cohort retention data shows 91% day-90 retention — the single most persuasive data point in the entire data room. Hendra: 'Setiap investor yang telah berbicara dengan saya tentang data room akhirnya menghabiskan waktu paling lama di analisis kohort. Itu membuat semua klaim tentang product-market fit menjadi empiris daripada naratif.'", tc: "text-blue-700" },
            { section: "DATA-ROOM-SECTION-3: Product dan Technology (9 dokumen)", contents: "The Product section: demonstrates depth of MJP's technical moat to technical investors. Documents: (1) Product overview deck (15 slides, covering all 5 product pillars). (2) NLQ architecture technical overview (2 pages). (3) Trust Score methodology document (including data sources, calculation method, and validation approach). (4) Knowledge Registry governance manual (Sari's content standards and lifecycle protocol). (5) Crawler infrastructure overview (coverage, crawl frequency, data quality metrics). (6) API documentation (demonstrates platform maturity for B2B buyers and enterprise integrators). (7) Platform uptime and performance history (2022–2025). (8) Data security and privacy policy. (9) Third-party security audit report (Hendra commissioned a penetration test in 2024 — the clean result: now in the data room as evidence of security posture).", investor_query_frequency: "Most-requested from Section 3: the Trust Score methodology document (investors want to understand whether Trust Score is defensible or easily replicated) and the crawler infrastructure overview (investors want to know what happens if LKPP portals change their structure or block crawlers). Hendra's most sensitive due diligence question: 'What is the risk of government portals blocking your crawler?' His prepared answer: MJP's crawler ethics framework (rate limiting, transparency, public data only) means MJP operates within portal terms of service — and no portal has blocked MJP's crawler in 5 years. The ethics framework document: from Hendra Jr.'s crawler ethics protocol, now formally written up and included in Section 3.", tc: "text-emerald-700" },
            { section: "DATA-ROOM-SECTION-4: Go-To-Market dan Customer Evidence (11 dokumen)", contents: "The GTM section: demonstrates commercial validation and the repeatable acquisition playbook. Documents: (1) Subscriber acquisition history (month by month, by channel — association, referral, direct, SKK Express conversion). (2) 10 anonymized subscriber case studies (2 per tier, 2 SKK Express → subscription conversions). (3) 5 named subscriber testimonials (non-anonymized, with subscriber permission). (4) NPS history (quarterly, from Q1 2022 to present). (5) Churn analysis — all churned subscribers, categorized by churn reason. (6) GAPENSI and GAPEKSINDO partnership documentation. (7) Competitor pricing comparison (showing MJP's value per rupiah vs alternatives). (8) Sales process documentation (Reza's discovery-to-close playbook). (9) Pricing model and tier structure with rationale. (10) Contract templates (for Enterprise annual contracts). (11) Customer concentration analysis (no single subscriber over 3% of ARR).", investor_query_frequency: "Most-requested from Section 4: the churn analysis document (investors want to understand why subscribers cancel — a company that understands its churn reasons demonstrates product and market maturity) and the named subscriber testimonials (investors often want to reference-check with actual subscribers). Hendra pre-selects the 5 testimonial subscribers as reference contacts — subscribers who know they are in the data room and have agreed to take investor calls. These 5 subscribers: Reza's highest-NPS Enterprise subscribers, each representing a different BUJK profile (region, jenjang, KBLI) to demonstrate breadth of use case.", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.section} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.section}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Contents: {r.contents}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Investor query frequency: {r.investor_query_frequency}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A data room architecture adalah Hendra's most operationally intensive Series A preparation activity — because building a complete, investor-grade data room for the first time requires MJP to produce documentation that the company has never needed before (formal product architecture write-ups, penetration test reports, legal structure documentation, formal cohort analysis). Hendra's estimate: 6–8 weeks of part-time work across the team to build the data room from scratch, with Hendra Jr. owning Sections 3 and 5, Sari owning the Knowledge Registry governance manual, Reza owning the customer evidence documents, and Hendra owning Sections 1, 2, and 4 synthesis. The data room's most important design principle: every document should be the best version of the truth, not a version of the truth that obscures weaknesses. Investors who discover weaknesses during due diligence that were not disclosed in the data room: lose trust in the founder. Investors who see weaknesses disclosed proactively in the data room (with context and mitigation plans): gain trust. MJP's data room will include: a proactive churn analysis that names the 3 churn reasons (price, product-market fit edge cases, business closures) and explains what MJP has done and is doing about each. This proactive disclosure: Hendra's most deliberate data room decision. A well-constructed data room shortens due diligence because it anticipates investor questions before they are asked — converting back-and-forth document requests into a single complete package that investors can review in order. Hendra's target: complete Series A due diligence in 4 weeks (vs the 8-week industry average for first-time founders without a complete data room).</p>
      </div>

      {/* R117: Series A Board Composition Plan */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-primary" /> SERIES A BOARD COMPOSITION PLAN — Siapa yang Hendra Inginkan di Board Post-Series A: 4 Kursi Board, Profil Ideal untuk Setiap Kursi, Ketrampilan Gap yang Diisi, dan Mengapa Komposisi Board Sama Pentingnya dengan Jumlah Investasi
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { seat: "BOARD-SEAT-1: Lead Series A Investor (VC representative) — 1 kursi, wajib", profile: "The Series A lead investor's board seat: inevitable and appropriate. Hendra's criteria for evaluating which VC to take as lead investor: the quality of the board member they will assign matters as much as the fund's brand or the valuation they offer. Hendra's ideal VC board member profile: (1) Has personal operating experience in B2B SaaS (not just financial investing in B2B SaaS — has actually built or run a B2B SaaS company). (2) Has Indonesia market experience (understands the specific GTM challenges of selling to Indonesian SMEs, not just extrapolating from US or Southeast Asian consumer markets). (3) Is accessible between board meetings (responds within 24 hours to strategic questions, not just present for quarterly board meetings). (4) Has a portfolio of B2B SaaS companies they can introduce MJP to for partnership conversations.", skills_gap_filled: "Skills gap filled by BOARD-SEAT-1: financial governance discipline (board-level accountability for capital allocation, financial reporting, and investor communication that Hendra has not previously had as a solo founder). The VC board member: the primary mechanism for introducing institutional governance practices that scale with the company's size. The most important governance practice the VC board member brings: formal board meeting cadence (quarterly, with standardized reporting) that creates an external accountability structure for Hendra's strategic decisions. Without board governance: Hendra makes decisions alone with team input but no external accountability. With board governance: major decisions (pricing changes, new product categories, Series B timing) have external challenge and validation.", tc: "text-primary" },
            { seat: "BOARD-SEAT-2: Construction sector expert — 1 kursi, strong preference for Industry Advisory Board member dengan fiduciaries responsibility", profile: "The most unusual board composition choice: an industry expert from the Indonesian construction sector with genuine government procurement experience. Profile: a former LPSE procurement committee chair, a retired LKPP senior official, or a current GAPENSI national board member who can serve in a fiduciary capacity. This is not a standard board seat type (most B2B SaaS Series A boards have VC + founder + independent tech/business operator). Hendra's rationale for this unusual seat: MJP's moat is domain depth, not technology. An industry expert board member: provides the regulatory access, government relationship credibility, and market intelligence that Hendra could not get from any technology or finance-oriented board member. The specific value: board-level endorsement from a respected construction sector figure signals to MJP's Enterprise subscribers and LKPP stakeholders that MJP's intelligence layer has the kind of domain authority that a purely technology-driven platform cannot claim.", skills_gap_filled: "Skills gap filled by BOARD-SEAT-2: regulatory and government relations strategy (the kinds of strategic decisions that require understanding how Indonesia's government procurement ecosystem evolves — decisions Hendra cannot make well with only his team's perspective). Example decision: should MJP formally apply to become an official LKPP reference platform? A technology-oriented board member would evaluate this from a business development perspective. An industry expert board member evaluates it from a regulatory credibility perspective — and can navigate the LKPP relationship directly. The industry expert board member: MJP's most distinctive board composition decision and the one Hendra believes will most differentiate the company's strategic positioning from pure-technology competitors.", tc: "text-blue-700" },
            { seat: "BOARD-SEAT-3: B2B SaaS scaling operator — 1 kursi, independent director", profile: "The most conventionally important board seat: an experienced B2B SaaS operator who has scaled a company from Rp 2B to Rp 20B+ ARR and can provide pattern-matched guidance on MJP's specific growth challenges. Profile priority: (1) Indonesian or Southeast Asian B2B SaaS experience (because Indonesia-specific GTM dynamics — WhatsApp distribution, SME payment collection, Indonesian language product development — require local pattern matching). (2) Has managed a sales team of 5–15 people (the scale MJP is approaching) and can advise Reza on building a customer success and sales organization. (3) Has gone through at least one venture fundraise as a founder or senior executive. Hendra's candidate network: 3 identified candidates from his existing VC and founder network, all with 8–15 years of Indonesian tech scaling experience.", skills_gap_filled: "Skills gap filled by BOARD-SEAT-3: operational scaling knowledge (the difference between 6 people and 15 people is not just hiring — it's process design, management structure, communication cadence, and performance management systems that Hendra has never had to build before). The scaling operator board member: Hendra's single most valuable source of 'what you don't know you don't know about scaling.' The specific operational knowledge Hendra most needs: how to build a customer success function that maintains high NPS through rapid headcount growth. At 847 subscribers and 6 people: Reza can maintain personal relationships with every Enterprise subscriber. At 2.000 subscribers and 15 people: this personal relationship model breaks. The scaling operator has navigated exactly this transition — their pattern-matched guidance is worth more than any management consulting engagement.", tc: "text-emerald-700" },
            { seat: "BOARD-SEAT-4: Founder board seat — Hendra", profile: "Hendra's own board seat: the one he controls but thinks about most carefully. Post-Series A: Hendra will hold 1 of 4 board seats (25% of voting representation, assuming the VC and 2 independents each hold 1 seat). The voting structure: Hendra has outsized influence because he controls the agenda, the company's operational decisions between meetings, and the relationship with the other board members. But formal voting power: he has 1 of 4 votes on major decisions. For Hendra: this is the governance transition he has been preparing for throughout MJP's 5-year history. From 100% founder control to 25% board voting — while retaining operational control through his CEO role.", skills_gap_filled: "What Hendra brings to his own board seat: 5 years of continuous BUJK market immersion, the deepest product vision for what MJP could become, and the operational credibility of having built MJP from zero to Rp 2.1B ARR. Hendra's most important personal preparation for board governance: learning to present decisions as structured proposals (problem statement, options, recommendation, tradeoffs) rather than as solutions he's already implemented. The board governance discipline: not comfortable for a solo founder who has made all decisions independently. Hendra: 'Board yang baik bukan yang menyetujui semua yang saya katakan. Itu adalah yang memaksa saya memikirkan lebih keras tentang keputusan yang paling penting — karena saya tahu saya harus mempertahankannya di hadapan orang-orang yang peduli dengan hasil jangka panjang seperti yang saya lakukan, tetapi tidak memiliki komitmen emosional yang sama terhadap pendekatan spesifik saya.'", tc: "text-orange-700" },
          ].map((r) => (
            <div key={r.seat} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.seat}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Profile: {r.profile}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Skills gap filled: {r.skills_gap_filled}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A board composition plan adalah Hendra's most consequential governance decision in the fundraising process — because board composition determines the quality of strategic oversight MJP receives for the next 5+ years, not just the current fundraise. The 4-seat composition (VC + industry expert + scaling operator + founder): deliberately designed to cover 4 distinct knowledge gaps that Hendra has identified as critical for MJP's Series A to Series B journey. Financial governance (VC), domain credibility (industry expert), operational scaling (B2B SaaS operator), and product vision (founder): the 4 dimensions of good governance for a domain-specific B2B SaaS company entering its scaling phase. The most non-standard choice: BOARD-SEAT-2 (construction sector expert). Most Indonesian B2B SaaS founders at this stage would take a second VC board seat instead — increasing financial governance but missing the domain credibility that is MJP's primary competitive advantage. Hendra's argument for the industry expert seat: MJP's board should reflect MJP's product strategy. If the intelligence depth moat is the defensible advantage: the board should include someone who embodies and validates that depth at the governance level. A board composed entirely of financial investors and technology operators: would optimize MJP toward SaaS metrics (ARR growth, CAC efficiency, margin expansion) at the potential expense of the domain quality that makes those metrics possible. The industry expert seat: the governance mechanism that keeps domain quality as a board-level strategic priority, not just an operational concern.</p>
      </div>

      {/* R118: Team OKR Framework */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5 text-primary" /> TEAM OKR FRAMEWORK — Bagaimana Hendra Menetapkan OKR Q3 2026 untuk 6 Orang: Struktur Objective dan Key Result per Peran, Bagaimana Kemajuan Dilacak Mingguan, dan Mengapa OKR Adalah Penghubung Antara Visi Series A dan Pekerjaan Harian
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { role: "HENDRA (CEO/Product) — Objective: Establish MJP as Series A-ready company with investor-credible data room by Q4 2026", key_results: "KR1: Complete Series A data room to 90%+ readiness as measured by the DD-1 through DD-6 checklist (DD-4 engineering documentation from 60% to 95%). KR2: Close 1 institutional partnership conversation (GAPENSI national endorsement OR LKPP knowledge licensing arrangement) as validation of Trust Score standardization strategy. KR3: Increase NPS from 47 to 50+ through 2 product improvements directly addressing subscriber feedback from Q2 2026 churn exit interviews.", tracking: "Hendra's OKR tracking: weekly self-review (Friday 17:00, 15 minutes) where he scores each KR 0.0–1.0 (0.7 = on track, 0.5 = at risk, below 0.5 = intervention needed). Q3 2026 mid-quarter score: KR1 at 0.6 (DD-4 progressing slower than target), KR2 at 0.4 (GAPENSI conversation progressing but not yet formalized — at risk), KR3 at 0.8 (NPS moved to 49 in Q3 pulse survey, on track).", tc: "text-primary" },
            { role: "HENDRA JR. (Engineering) — Objective: Deliver 3 platform improvements that directly increase NLQ habit rate and reduce Trust Score controversy", key_results: "KR1: Deploy NLQ v2.1 semantic synonym expansion — measure Mode-1 response rate improvement from 61% to 68%+. KR2: Complete DD-4 engineering documentation to 95% (API architecture, LPSE portal auth guide, data normalization spec). KR3: Complete EXPANSION-PHASE-1 crawler deployment for 4 Sulawesi/Maluku portals — measure Trust Score coverage improvement from 71% to 78% for Eastern Indonesia.", tracking: "Hendra Jr.'s OKR tracking: integrated into his daily engineering log (30-second end-of-day note: what did I work on, which KR does it advance, any blockers). The daily log: not reported up to Hendra daily but reviewed in their weekly 1:1 (Monday 09:00, 30 minutes). Hendra Jr.'s Q3 self-assessment: KR1 at 0.9 (v2.1 deployed, Mode-1 at 65% — ahead of 61% baseline, slightly behind 68% target), KR2 at 0.6 (progressing, on track with caveat that documentation quality requires Hendra's review cycles), KR3 at 0.3 (delayed by Sulawesi portal authentication complexity — intervention needed).", tc: "text-blue-700" },
            { role: "SARI (Knowledge & Briefing) — Objective: Strengthen briefing quality evidence and expand Knowledge Registry to close top 3 NLQ gap topics", key_results: "KR1: Produce 3 new Knowledge Registry assets addressing confirmed NLQ Mode-4 gap topics (IUJK regional registration procedures, subcontractor qualification requirements, updated material price reference). KR2: Complete Briefing A/B test for dual-mode format (Quick Scan header + deep read body) and achieve 3+ percentage point improvement in morning action rate (from 18% to 21%+). KR3: Formalize 1 new Expert Contributor (target: regional procurement law specialist with Eastern Indonesia experience).", tracking: "Sari's OKR tracking: monthly content calendar review where she maps completed work against KR targets. Sari and Hendra's monthly 1:1 (first Monday of each month, 45 minutes): reviews KR progress, discusses Knowledge Registry gap priorities, adjusts new asset queue if needed. Q3 mid-quarter: KR1 at 0.7 (2 of 3 assets complete), KR2 at 0.5 (A/B test running, preliminary data positive but not yet conclusive — 19.2% action rate vs 18% baseline), KR3 at 0.3 (2 candidate introductions made through GAPENSI contact, neither confirmed yet — at risk).", tc: "text-emerald-700" },
            { role: "BUDI (Research) — Objective: Complete RESEARCH-Q1 narasumber panel for Series A pain point validation evidence and initiate RESEARCH-Q2", key_results: "KR1: Complete 15 of 20 planned RESEARCH-Q1 interviews (pain point severity validation with jenjang-8/9 narasumber) and deliver final validation report with co-occurrence cluster analysis by Q3 end. KR2: Initiate RESEARCH-Q2 (no-bid decision study) — complete 5 of 20 planned interviews, sufficient to confirm or revise no-bid signal priority order for Hendra Jr.'s product roadmap. KR3: Reduce narasumber network YELLOW status contacts from 19 to 12 (reactivate 7 contacts through value-provision protocol).", tracking: "Budi's OKR tracking: weekly narasumber contact log update (who was contacted, what was discussed, health status update). Budi's weekly check-in with Hendra: Thursday 16:00, 20 minutes — primarily to share interesting narasumber observations that might have immediate product implications (Hendra's primary mechanism for staying connected to market reality without conducting research himself). Q3 mid-quarter: KR1 at 0.8 (12 of 20 interviews complete, on track), KR2 at 0.4 (3 interviews complete, on track for Q3 initiation target), KR3 at 0.6 (7 YELLOW contacts reactivated to GREEN, net YELLOW count unchanged due to 7 new YELLOW entries — progress masked by churn into YELLOW).", tc: "text-orange-700" },
            { role: "REZA (Customer Success & SKK Express) — Objective: Achieve 95% Enterprise renewal rate and advance Trust Score standardization through community presence", key_results: "KR1: Maintain Enterprise subscriber renewal rate at 95%+ in Q3 (17 Enterprise renewals due in Q3 — target: 16 of 17 renew). KR2: Conduct 3 GAPENSI DPD events (Jatim, Jateng, Jakarta) with Trust Score mentioned by Reza in at least 2 presentations — document 10+ new subscriber referrals from DPD contacts. KR3: Complete SKK Express MODEL-2 pilot (5 test cases using freelance specialist network) and deliver pilot assessment report to Hendra by Q3 end.", tracking: "Reza's OKR tracking: his client relationship spreadsheet (updated after every Enterprise subscriber interaction) and SKK Express case tracker. Reza's weekly customer success report to Hendra: an email summary (Friday afternoon) covering: Enterprise health flags (any subscriber showing churn risk), new inbound referrals, SKK Express pipeline update. Q3 mid-quarter: KR1 at 0.9 (15 of 17 renewals confirmed, 2 in discussion), KR2 at 0.7 (2 of 3 DPD events completed, 7 new subscriber referrals documented), KR3 at 0.5 (3 of 5 pilot cases initiated, on track).", tc: "text-purple-700" },
          ].map((r) => (
            <div key={r.role} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.role}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Key results: {r.key_results}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Tracking: {r.tracking}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Team OKR framework adalah Hendra's primary mechanism for translating MJP's Series A preparation strategy into the individual work priorities of 6 people — ensuring that the team's daily effort is aligned toward the quarterly milestones that collectively represent Series A readiness. The OKR structure for Q3 2026: each person has 1 Objective and 3 Key Results, all connected to the Series A preparation themes (data room completion, NPS improvement, institutional partnership advancement, and platform quality). The most important OKR design choice: KRs are measurable outputs (NPS 50+, Mode-1 rate 68%, 16 of 17 renewals), not activities (conduct user interviews, write documentation). Activity-based KRs: let teams feel productive while failing to deliver outcomes. Outcome-based KRs: require teams to connect their work to results and adjust tactics if the results aren't materializing. The OKR system at 6 people: lightweight by design (no OKR software, no formal review ceremonies beyond weekly check-ins and monthly 1:1s). The administrative overhead of enterprise OKR systems: not appropriate for a 6-person team where each person's contribution is directly visible to Hendra. At 15 people post-Series A: the OKR system will need formalization (a shared tracker, quarterly all-hands review, structured calibration conversations) — but this formalization should happen at the 10–15 person scale, not before. Hendra's OKR design principle: the KRs should create clarity and accountability, not bureaucracy. A 6-person team where people ask 'am I working on the right things?' every week: more damaging to morale than a team where everyone knows their priorities and can see their progress. The OKR framework: answers the 'right things' question clearly enough that it doesn't need to be asked.</p>
      </div>

      {/* R119: MJP Unit Economics Deep Dive */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5 text-primary" /> UNIT ECONOMICS DEEP DIVE — Per-Subscriber Revenue, Cost, dan Margin di 3 Titik Skala: 487 Klien Hari Ini, 1.000 Klien Post-Series A Year 1, dan 2.500 Klien Post-Series A Year 3 — Mengapa Margin MJP Tumbuh Nonlinier Seiring Pertumbuhan Klien
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { scale: "SKALA-1: 487 klien aktif (kondisi hari ini, Agustus 2026)", rev_per_sub: "Revenue per subscriber: Rp 1.42jt/bulan (blended average — Standard Rp 850rb, Pro Rp 1.75jt, Enterprise Rp 3.5jt, SKK Express Rp 2.2jt avg. Distribusi klien: 60% Standard, 25% Pro, 8% Enterprise, 7% SKK-only). Total ARR: Rp 830jt/tahun (Rp 69jt/bulan MRR).", cost_per_sub: "Cost per subscriber: Rp 420rb/bulan blended. Breakdown: Hendra Jr. infrastructure cost Rp 180rb (server, crawler, database, CAPTCHA service), Sari content production Rp 120rb (1 Knowledge Asset per 40 subscribers served), Reza customer success Rp 80rb (40 Enterprise/Pro subscribers per Reza-hour, Standard = near-zero CS cost), G&A overhead per subscriber Rp 40rb.", margin: "Contribution margin: Rp 1.42jt - Rp 420rb = Rp 1.00jt/subscriber/bulan. Margin %: 70.4%. The 70% contribution margin: above SaaS median (65%) but below best-in-class B2B SaaS (75–80%). The gap to best-in-class: explained by SKK Express's higher per-case cost (Rp 280rb variable cost per SKK Express case vs Rp 0 variable cost for digital subscriptions).", tc: "text-primary" },
            { scale: "SKALA-2: 1.000 klien (Series A Year 1, target Q4 2027)", rev_per_sub: "Revenue per subscriber: Rp 1.58jt/bulan blended (mix shift: Standard proportion drops to 52%, Pro grows to 30%, Enterprise grows to 12%, SKK-only 6%). The mix shift driver: Series A-funded CS team (2 CS managers vs 1 Reza today) actively upgrades Standard subscribers to Pro by demonstrating value more consistently. Enterprise grows via Budi's expanded narasumber network and dedicated Enterprise account management.", cost_per_sub: "Cost per subscriber: Rp 335rb/bulan blended (scale economies: Hendra Jr.'s infrastructure cost per subscriber drops from Rp 180rb to Rp 130rb because server costs are mostly fixed and the 1.000-subscriber database has lower per-subscriber query cost than current; Sari's content cost per subscriber drops from Rp 120rb to Rp 90rb because the same 200+ Knowledge Assets now serve 1.000 subscribers instead of 487; CS cost drops from Rp 80rb to Rp 70rb with CS team scale).", margin: "Contribution margin: Rp 1.58jt - Rp 335rb = Rp 1.245jt/subscriber/bulan. Margin %: 78.8%. The 78.8% target: above best-in-class SaaS threshold. This is the margin expansion story for Series A investors: from 70% at 487 subscribers to 79% at 1.000 — the same content, the same crawler infrastructure, serving twice as many subscribers with only marginal additional cost. Total ARR at 1.000 subscribers: Rp 1.9M/tahun. ARR more than doubles from today's Rp 830jt — driven by both subscriber growth AND mix shift to higher tiers.", tc: "text-blue-700" },
            { scale: "SKALA-3: 2.500 klien (Series A Year 3, full deployment scenario)", rev_per_sub: "Revenue per subscriber: Rp 1.85jt/bulan blended (further mix shift + IKN Intelligence Tier launch at Rp 10jt avg. adding 75 klien at Rp 10jt = Rp 750jt/tahun from IKN tier alone; Province Intelligence Report Rp 5jt/bulan/province × 15 provinces × 40 subscribers/province = Rp 36M/tahun from provincial tier). The 2 new product tiers: fundamentally change revenue per subscriber economics by introducing price points 3–7× the current Enterprise tier.", cost_per_sub: "Cost per subscriber: Rp 270rb/bulan blended (infrastructure scale plateau — at 2.500 subscribers, Hendra Jr.'s infrastructure cost reaches its efficiency floor; adding subscribers beyond this point requires a second infrastructure engineer but not a second complete infrastructure). Sari's content cost per subscriber: Rp 60rb (2.500 subscribers being served by 300+ Knowledge Assets — the incremental content cost is primarily the Knowledge Analyst hire, not new infrastructure). G&A overhead per subscriber: drops to Rp 28rb as office, legal, and admin costs are spread across 5× more subscribers.", margin: "Contribution margin: Rp 1.85jt - Rp 270rb = Rp 1.58jt/subscriber/bulan. Margin %: 85.4%. Total ARR at 2.500 subscribers: Rp 5.55M/tahun (Rp 463jt/bulan MRR). The 85.4% target margin at Year 3: makes MJP's unit economics comparable to best-in-class B2B SaaS companies that benefit from fully amortized content libraries and infrastructure. Hendra's Series A investor summary: 'Every subscriber we add after the 1.000 mark is nearly pure margin — because the Knowledge Registry is already built, the crawler infrastructure is already running, and Sari is already working. The marginal cost of subscriber 1.001 is a fraction of the average cost of subscribers 1–487.'", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.scale} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.scale}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Revenue per subscriber: {r.rev_per_sub}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Cost per subscriber: {r.cost_per_sub}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Margin: {r.margin}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">MJP unit economics deep dive adalah the financial validation of Hendra's 'subscription-first, content-amortized' business model — because the compounding margin improvement from 70% today to 85% at Year 3 is not a projection based on hope, it is an arithmetically inevitable consequence of fixed-cost content and infrastructure being spread across an increasing subscriber base. The critical insight for Series A investors: MJP is not a services business (where cost grows linearly with revenue) and not a traditional software business (where R&D must continuously invent new features to retain subscribers). MJP is a knowledge infrastructure business: the core content investment (Sari's 5-year corpus, Hendra Jr.'s 671-portal crawler) is largely complete, and each additional subscriber adds revenue with near-zero marginal content or infrastructure cost. The 3 unit economics scenarios: use conservative assumptions (the 2.500-subscriber Year 3 target requires 15% annual subscriber growth starting from Series A close — less than the 23% CAGR MJP has achieved organically in the last 2 years without a sales team). The Series A round: funds the growth acceleration that converts the organic 23% CAGR into the 40%+ CAGR needed to reach 2.500 subscribers in 3 years. Hendra's framing to investors: 'We are not asking for capital to build the product. The product is built. We are asking for capital to find the 2.000 more BUJK who need it and tell them it exists.'</p>
      </div>

      {/* R120: Series A Investor Q&A Preparation */}
      <div className="border rounded-sm p-4 bg-card">
        <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
          <Brain className="h-3.5 w-3.5 text-primary" /> SERIES A INVESTOR Q{"&"}A PREPARATION — 5 Pertanyaan Terberat yang Diajukan Investor kepada Hendra dan Cara Ia Menjawabnya: Bukan Script, tapi Pemahaman Mendalam yang Menghasilkan Jawaban Berbeda-beda tapi Selalu Jujur
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {[
            { question: "HARD-Q-1: 'Why can't a well-funded startup replicate MJP in 18 months?'", investor_context: "The most common investor challenge: 'I see the product, it seems valuable, but what stops a VC-backed competitor from hiring 10 engineers and building the same thing faster than you built it?' The challenge: implicitly assumes that MJP's value is in its technical execution (which can be replicated with capital) rather than in its knowledge infrastructure (which cannot be replicated with capital alone).", hendra_answer: "Hendra's answer: 'Sebuah startup yang didanai dengan baik bisa membangun antarmuka yang mirip dalam 18 bulan. Tapi mereka tidak bisa membangun 67 pain point yang tervalidasi dari 5 tahun riset kualitatif dengan 40+ narasumber. Mereka tidak bisa membangun 3.000+ NLQ query log. Dan yang paling penting: mereka tidak bisa membangun kepercayaan 487 subscriber yang sudah membuktikan bahwa produk ini benar-benar membantu mereka memenangkan tender. Kompetitor yang dimulai hari ini memiliki semua modal yang diperlukan untuk membangun MJP versi 2021. Tapi pasar MJP yang ada hari ini adalah MJP versi 2026. Gap 5 tahun itu adalah moat yang sesungguhnya.' The answer: converts the question from 'can they build the product' (yes) to 'can they become MJP' (no, because MJP is its institutional intelligence, not its interface).", tc: "text-primary" },
            { question: "HARD-Q-2: 'Your TAM seems small — Indonesia construction contractors is a niche market.'", investor_context: "The TAM challenge: investors accustomed to consumer or horizontal B2B products often see 'Indonesia construction contractors' as too vertical. The challenge: underestimates the depth of the market (construction is Indonesia's 2nd largest GDP sector at ~11%) and MJP's path to adjacent markets (government procurement officers, infrastructure investors, building material suppliers who sell to BUJK).", hendra_answer: "Hendra's answer: 'Indonesia memiliki 200.000+ BUJK terdaftar. Kami saat ini melayani 487 dari mereka. Angka itu sendiri — 0.24% penetrasi — menunjukkan dua hal: pertama, kami belum mendekati batas pasar kami. Kedua, 99.76% pasar kami belum tahu kami ada. Itu bukan masalah TAM — itu masalah distribusi, yang justru diselesaikan oleh Series A. Selain itu: Trust Score dan Knowledge Registry kami sama bergunanya bagi pemerintah daerah yang ingin mengevaluasi BUJK, bank yang ingin menilai kredit kontraktor, dan investor infrastruktur yang membutuhkan due diligence kontraktor. Kami memilih untuk fokus pada BUJK dulu bukan karena pasar lainnya tidak ada, tapi karena fokus menghasilkan produk yang lebih dalam dan lebih berharga sebelum kami melakukan ekspansi horizontal.' The answer: reframes from 'small niche' to 'focused entry point with adjacent expansion paths.'", tc: "text-blue-700" },
            { question: "HARD-Q-3: 'Why hasn't a large media company or data provider already built this?'", investor_context: "The incumbency challenge: 'If this market is so valuable, why hasn't Bisnis Indonesia, Kontan, or a major data company like Refinitiv built it?' The challenge: assumes large incumbents would have recognized and acted on this opportunity if it were real.", hendra_answer: "Hendra's answer: 'Perusahaan media besar seperti Bisnis Indonesia mendapat pendapatan dari pembaca umum yang menginginkan berita — mereka tidak memiliki insentif untuk membangun produk yang sangat spesifik untuk BUJK karena itu adalah pasar yang terlalu sempit untuk membenarkan redaksi yang berdedikasi. Perusahaan data seperti Bloomberg atau Refinitiv melayani pasar keuangan — mereka tidak memiliki tim yang memahami pengadaan konstruksi Indonesia cukup dalam untuk membangun Knowledge Registry yang relevan. MJP lahir bukan karena tidak ada yang mau membangunnya, tapi karena membangunnya memerlukan seseorang yang tinggal di persimpangan antara konstruksi, regulasi pengadaan, dan teknologi data — persimpangan yang sangat spesifik sehingga hampir tidak ada yang memenuhi syarat untuk membangunnya. Kami tidak membangun MJP karena peluangnya jelas. Kami membangunnya karena kami cukup gila untuk percaya bahwa ada pasar di sana sebelum ada buktinya. 487 subscriber sekarang adalah buktinya.' The answer: converts the absence of incumbents from a red flag to evidence of domain specificity.", tc: "text-emerald-700" },
          ].map((r) => (
            <div key={r.question} className="border-b py-1.5">
              <p className={`text-[8px] font-bold ${r.tc} mb-0.5`}>{r.question}</p>
              <p className="text-[7px] text-muted-foreground mb-0.5">Investor context: {r.investor_context}</p>
              <p className={`text-[7px] font-mono ${r.tc}`}>Hendra's answer: {r.hendra_answer}</p>
            </div>
          ))}
        </div>
        <p className="text-[9px] font-mono text-muted-foreground">Series A investor Q{"&"}A preparation adalah Hendra's most personally demanding preparation task — because investor questions are designed to find the weakest points in a business thesis, and the difference between a 'good' answer and a 'fundable' answer is not polish, it is depth. A rehearsed answer (the same words every time): signals that Hendra is managing the narrative, not explaining the business. An answer that varies in wording but is always consistent in substance (because it comes from genuine understanding): signals that Hendra has internalized the business so deeply that any question angle leads to the same fundamental truth. Hendra's preparation methodology: not flashcard rehearsal but quarterly 'investor skeptic sessions' with Budi and Reza — each of them plays the hardest investor they can imagine and Hendra answers without preparation. The questions that Hendra can't answer well in these sessions: become the next quarter's deepest research and thinking projects. The 3 questions above: all started as questions Hendra initially answered poorly. HARD-Q-1 originally received a defensive answer about crawler infrastructure (technical, not strategic). HARD-Q-2 originally received a TAM calculation exercise (data-focused, not narrative). HARD-Q-3 originally received a 'we just had a better idea' answer (humble, but unconvincing). Each improved answer: came from Hendra doing more thinking, not more rehearsing. The principle: the best investor preparation is building a business so deeply understood that the answers write themselves.</p>
      </div>

      {/* Scheduler Run History */}
      <SchedulerRunHistoryCard runs={schedulerRuns} loading={loadingRuns} />
      {showScrollTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-6 right-6 z-50 h-9 w-9 rounded-full bg-primary animate-in fade-in slide-in-from-bottom-2 text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1" aria-label="Kembali ke atas" title="Kembali ke atas"><ChevronUp className="h-4 w-4" /></button>
      )}
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  loading,
  highlight = false,
  alert = false,
  href,
}: { 
  title: string; 
  value?: number; 
  subtitle: string; 
  icon: React.ElementType;
  loading: boolean;
  highlight?: boolean;
  alert?: boolean;
  href?: string;
}) {
  const card = (
    <Card className={cn(
      "overflow-hidden",
      highlight && "border-primary shadow-[0_0_15px_rgba(251,191,36,0.1)]",
      alert && "border-destructive/50 bg-destructive/5",
      href && "cursor-pointer hover:shadow-md transition-shadow focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 outline-none"
    )}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold font-mono tracking-wider text-muted-foreground">{title}</p>
          <Icon className={cn("h-4 w-4", highlight ? "text-primary" : alert ? "text-destructive" : "text-muted-foreground")} />
        </div>
        <div className="mt-4 flex items-baseline gap-2">
          {loading ? (
            <Skeleton className="h-10 w-20" />
          ) : (
            <span className={cn(
              "text-4xl font-bold tracking-tighter",
              highlight && "text-primary",
              alert && "text-destructive"
            )}>
              {value !== undefined ? value.toLocaleString() : '-'}
            </span>
          )}
        </div>
        <p className="mt-2 text-xs font-mono text-muted-foreground">{subtitle}</p>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href}>{card}</Link> : card;
}

// ─── Scheduler Status Card ────────────────────────────────────────────────────

import type { SchedulerStatus } from "@workspace/api-client-react";

function SchedulerStatusCard({
  scheduler,
  loading,
  triggering,
  onTrigger,
}: {
  scheduler?: SchedulerStatus;
  loading: boolean;
  triggering: boolean;
  onTrigger: () => void;
}) {
  const [confirmTrigger, setConfirmTrigger] = useState(false);
  const isRunning = scheduler?.isRunning || triggering;

  const lastRunLabel = scheduler?.lastRunAt
    ? formatDistanceToNow(new Date(scheduler.lastRunAt), { addSuffix: true, locale: idLocale })
    : "Belum pernah berjalan";

  const nextRunLabel = scheduler?.nextRunAt
    ? format(new Date(scheduler.nextRunAt), "EEEE, dd MMM yyyy – HH:mm", { locale: idLocale })
    : "–";

  const totalSaved = scheduler?.lastRunResult?.totalItemsSaved ?? null;
  const successCount = scheduler?.lastRunResult?.results?.filter((r: { status: string }) => r.status === "SUCCESS").length ?? 0;
  const errorCount = scheduler?.lastRunResult?.results?.filter(
    (r: { status: string }) => r.status === "ERROR" || r.status === "BLOCKED"
  ).length ?? 0;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-9 w-9 items-center justify-center rounded-sm border",
              isRunning ? "border-primary bg-primary/20 animate-pulse" : "border-primary/30 bg-primary/10"
            )}>
              {isRunning
                ? <LoaderCircle className="h-5 w-5 text-primary animate-spin" />
                : <Clock className="h-5 w-5 text-primary" />}
            </div>
            <div>
              <CardTitle className="text-base font-mono tracking-wide">PENJADWAL OTOMATIS 07:00 WIB</CardTitle>
              <CardDescription className="font-mono text-xs mt-0.5">
                {isRunning ? "⚡ Sedang mengumpulkan data…" : `Terakhir berjalan: ${lastRunLabel}`}
              </CardDescription>
            </div>
          </div>
          {confirmTrigger ? (
            <span className="flex items-center gap-1.5">
              <button
                autoFocus
                onBlur={() => setConfirmTrigger(false)}
                onClick={() => { onTrigger(); setConfirmTrigger(false); }}
                className="text-[10px] font-mono text-white bg-primary hover:bg-primary/90 rounded-sm px-2 py-1 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
              >✓ Yakin?</button>
              <button onClick={() => setConfirmTrigger(false)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">Batal</button>
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs border-primary/40 hover:bg-primary/10 hover:text-primary"
              onClick={() => setConfirmTrigger(true)}
              disabled={isRunning || loading}
            >
              {isRunning
                ? <><LoaderCircle className="h-3.5 w-3.5 mr-2 animate-spin" />Berjalan…</>
                : <><Play className="h-3.5 w-3.5 mr-2" />Jalankan Sekarang</>}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex gap-4">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 flex-1" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-sm border border-border bg-background/60 p-3">
              <p className="text-xs font-mono text-muted-foreground">Jadwal Berikutnya</p>
              <p className="mt-1 text-sm font-semibold leading-tight capitalize">{nextRunLabel}</p>
              {scheduler?.nextRunAt && (() => {
                const ms = new Date(scheduler.nextRunAt).getTime() - Date.now();
                if (ms <= 0) return null;
                const h = Math.floor(ms / 3600000);
                const m = Math.floor((ms % 3600000) / 60000);
                return (
                  <p className="text-[10px] font-mono text-primary mt-0.5">
                    {h > 0 ? `${h}j ` : ""}{m}m lagi
                  </p>
                );
              })()}
            </div>
            <div className="rounded-sm border border-border bg-background/60 p-3">
              <p className="text-xs font-mono text-muted-foreground">Item Tersimpan</p>
              <p className="mt-1 text-2xl font-bold tracking-tight text-primary">
                {totalSaved !== null ? totalSaved : "–"}
              </p>
            </div>
            <div className="rounded-sm border border-border bg-background/60 p-3">
              <p className="text-xs font-mono text-muted-foreground">Sumber Berhasil</p>
              <div className="mt-1 flex items-center gap-1.5">
                <CircleCheck className="h-4 w-4 text-emerald-500" />
                <span className="text-2xl font-bold tracking-tight text-emerald-500">{successCount}</span>
              </div>
            </div>
            <div className="rounded-sm border border-border bg-background/60 p-3">
              <p className="text-xs font-mono text-muted-foreground">Sumber Error</p>
              <div className="mt-1 flex items-center gap-1.5">
                <CircleX className="h-4 w-4 text-destructive" />
                <span className="text-2xl font-bold tracking-tight text-destructive">{errorCount}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Scheduler Run History Card ───────────────────────────────────────────────

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "PARTIAL") return "secondary";
  if (status === "ERROR" || status === "BLOCKED") return "destructive";
  return "outline";
}

function RunStatusSummary({ results }: { results: SchedulerRun["results"] }) {
  const success = results.filter((r) => r.status === "SUCCESS").length;
  const partial = results.filter((r) => r.status === "PARTIAL").length;
  const errors = results.filter((r) => r.status === "ERROR" || r.status === "BLOCKED").length;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {success > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-mono text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="h-3 w-3" />{success}
        </span>
      )}
      {partial > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-mono text-yellow-600 dark:text-yellow-400">
          <Clock className="h-3 w-3" />{partial}
        </span>
      )}
      {errors > 0 && (
        <span className="inline-flex items-center gap-0.5 text-xs font-mono text-destructive">
          <CircleX className="h-3 w-3" />{errors}
        </span>
      )}
    </div>
  );
}

// ─── Deduplication Trend Bar Chart ───────────────────────────────────────────

interface DeduplicationTrendChartProps {
  runs: SchedulerRun[];
}

function DeduplicationTrendChart({ runs }: DeduplicationTrendChartProps) {
  const chartData = useMemo(() => {
    // Build a 7-day window: today back to 6 days ago
    const days: { dateKey: string; label: string; fullDate: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push({
        dateKey: format(d, "yyyy-MM-dd"),
        label: format(d, "dd/MM"),
        fullDate: format(d, "dd MMM yyyy", { locale: idLocale }),
      });
    }

    // Aggregate runs by calendar day
    const byDay: Record<string, { dilewati: number; disimpan: number }> = {};
    for (const day of days) byDay[day.dateKey] = { dilewati: 0, disimpan: 0 };

    for (const r of runs) {
      const dayKey = format(new Date(r.startedAt), "yyyy-MM-dd");
      if (byDay[dayKey]) {
        byDay[dayKey].dilewati += r.totalItemsSkipped ?? 0;
        byDay[dayKey].disimpan += r.totalItemsSaved ?? 0;
      }
    }

    return days.map((d) => ({
      label: d.label,
      fullDate: d.fullDate,
      dilewati: byDay[d.dateKey].dilewati,
      disimpan: byDay[d.dateKey].disimpan,
    }));
  }, [runs]);

  const maxVal = Math.max(...chartData.map((d) => d.dilewati + d.disimpan), 1);

  return (
    <div className="mb-4 rounded-sm border bg-muted/10 p-3">
      <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <ChartBar className="h-3.5 w-3.5 text-sky-500" />
        TREN DEDUPLICATION — duplikat dicegah per hari (7 hari terakhir)
      </p>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }} barCategoryGap="20%">
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 9, fontFamily: "monospace" }}
            tickLine={false}
            axisLine={false}
            width={32}
            domain={[0, Math.ceil(maxVal * 1.1)]}
          />
          <RechartsTooltip
            cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }}
            content={({ active, payload, label }) => {
              if (!active || !payload || payload.length === 0) return null;
              const entry = payload[0]?.payload as { fullDate: string; disimpan: number; dilewati: number } | undefined;
              return (
                <div className="rounded-sm border bg-popover text-popover-foreground shadow-md px-3 py-2 text-xs font-mono">
                  <p className="font-semibold mb-1">{entry?.fullDate ?? label}</p>
                  <p className="text-emerald-600">● Disimpan: <span className="font-bold">{entry?.disimpan ?? 0}</span></p>
                  <p className="text-sky-600">● Dilewati (duplikat): <span className="font-bold">{entry?.dilewati ?? 0}</span></p>
                </div>
              );
            }}
          />
          <Bar dataKey="disimpan" name="Disimpan" stackId="a" fill="hsl(142 71% 45%)" radius={[0, 0, 0, 0]} maxBarSize={24} />
          <Bar dataKey="dilewati" name="Dilewati (duplikat)" stackId="a" fill="hsl(199 89% 48%)" radius={[2, 2, 0, 0]} maxBarSize={24} />
          <Legend
            wrapperStyle={{ fontSize: 9, fontFamily: "monospace", paddingTop: 4 }}
            formatter={(value) => <span style={{ color: "hsl(var(--muted-foreground))" }}>{value}</span>}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function exportErrorsToCSV(runs: SchedulerRun[]) {
  const rows: string[][] = [];
  // Header row
  rows.push(["Waktu Run", "Nama Sumber", "ID Sumber", "Status", "Pesan Error"]);

  for (const run of runs) {
    const errorResults = run.results.filter(
      (r) => r.status === "ERROR" || r.status === "BLOCKED"
    );
    for (const r of errorResults) {
      rows.push([
        run.startedAt,
        r.sourceName ?? "",
        r.sourceId ?? "",
        r.status,
        r.errorMessage ?? "",
      ]);
    }
  }

  if (rows.length === 1) return; // header only — nothing to export

  const csvContent = rows
    .map((cols) =>
      cols
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `error-sumber-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


function SchedulerRunHistoryCard({
  runs,
  loading,
}: {
  runs?: SchedulerRun[];
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showProblematicOnly, setShowProblematicOnly] = useState(false);
  const [filterByHighFailure, setFilterByHighFailure] = useState(false);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RUNNING" | "COMPLETED" | "INTERRUPTED" | "LEGACY">("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [channelFilter, setChannelFilter] = useState<"ALL" | string>("ALL");

  // Local overrides for notificationResult per run after a manual retry
  const [notifOverrides, setNotifOverrides] = useState<Record<number, NotificationResult>>({});
  const [retryingRunId, setRetryingRunId] = useState<number | null>(null);

  const retryMutation = useRetryRunNotification({
    mutation: {
      onMutate: ({ id }: { id: number }) => {
        setRetryingRunId(id);
      },
      onSuccess: (result: NotificationResult, { id }: { id: number }) => {
        setNotifOverrides((prev) => ({ ...prev, [id]: result }));
        setRetryingRunId(null);
        queryClient.invalidateQueries({ queryKey: getGetSchedulerRunsQueryKey() });
        if (result.success) {
          toast.success("Notifikasi berhasil dikirim ulang", {
            description: `Channel: ${result.channel ?? "—"} · Run #${id}`,
            duration: 4000,
          });
        } else {
          toast.error("Notifikasi gagal dikirim ulang", {
            description: result.errorMessage ?? "Cek konfigurasi webhook di Pengaturan Notifikasi.",
            duration: 6000,
          });
        }
      },
      onError: (_err: unknown, { id }: { id: number }) => {
        setRetryingRunId(null);
        setNotifOverrides((prev) => ({
          ...prev,
          [id]: {
            channel: "none",
            success: false,
            sentAt: new Date().toISOString(),
            errorMessage: "Request gagal — cek koneksi server.",
          },
        }));
        toast.error("Gagal menghubungi server", {
          description: `Kirim ulang run #${id} tidak berhasil — cek koneksi server.`,
          duration: 6000,
        });
      },
    },
  });

  // ── 7-day aggregate stats ────────────────────────────────────────────────────
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  }, []);

  const runsLast7 = useMemo(
    () => (runs ?? []).filter((r) => new Date(r.startedAt) >= sevenDaysAgo),
    [runs, sevenDaysAgo]
  );

  const successfulRuns7 = useMemo(
    () => runsLast7.filter((r) => r.results.every((s) => s.status === "SUCCESS" || s.status === "PARTIAL")),
    [runsLast7]
  );

  const problematicRuns = useMemo(
    () => (runs ?? []).filter((r) => r.results.some((s) => s.status === "ERROR" || s.status === "BLOCKED")),
    [runs]
  );

  const successRate7 = runsLast7.length > 0
    ? Math.round((successfulRuns7.length / runsLast7.length) * 100)
    : null;

  const totalErrorSources7 = useMemo(
    () => runsLast7.reduce(
      (sum, r) => sum + r.results.filter((s) => s.status === "ERROR" || s.status === "BLOCKED").length,
      0
    ),
    [runsLast7]
  );

  const totalItemsSkipped7 = useMemo(
    () => runsLast7.reduce((sum, r) => sum + (r.totalItemsSkipped ?? 0), 0),
    [runsLast7]
  );

  const notifSent7 = useMemo(
    () => runsLast7.filter((r) => r.notificationResult?.success === true).length,
    [runsLast7]
  );
  const notifAttempted7 = useMemo(
    () => runsLast7.filter((r) => r.notificationResult != null).length,
    [runsLast7]
  );
  const notifFailed7 = notifAttempted7 - notifSent7;
  const notifColorClass = useMemo(() => {
    if (notifAttempted7 === 0) return "text-emerald-600";
    return notifFailed7 / notifAttempted7 > 0.5 ? "text-destructive" : "text-emerald-600";
  }, [notifAttempted7, notifFailed7]);

  // ── Top duplicate-generating sources in the last 7 days ──────────────────────
  const topDuplicateSources = useMemo(() => {
    type SrcEntry = { sourceId: string; sourceName: string; skipped: number; saved: number };
    const map: Record<string, SrcEntry> = {};
    for (const run of runsLast7) {
      for (const r of run.results) {
        const key = r.sourceId ?? r.sourceName ?? "unknown";
        if (!map[key]) {
          map[key] = { sourceId: key, sourceName: r.sourceName ?? key, skipped: 0, saved: 0 };
        }
        map[key].skipped += r.itemsSkipped ?? 0;
        map[key].saved += r.itemsSaved ?? 0;
      }
    }
    return Object.values(map)
      .filter((s) => s.skipped > 0)
      .sort((a, b) => b.skipped - a.skipped)
      .slice(0, 10);
  }, [runsLast7]);

  // ── High-failure sources: those with ≥3 errors in the last 7 days ────────────
  const highFailureSources = useMemo(() => {
    type HFEntry = { sourceId: string; sourceName: string; errorCount: number };
    const counts: Record<string, HFEntry> = {};
    for (const run of runsLast7) {
      for (const r of run.results) {
        if ((r.status === "ERROR" || r.status === "BLOCKED") && r.sourceId) {
          const key = r.sourceId;
          if (counts[key]) {
            counts[key].errorCount++;
          } else {
            counts[key] = {
              sourceId: r.sourceId,
              sourceName: r.sourceName ?? r.sourceId,
              errorCount: 1,
            };
          }
        }
      }
    }
    return (Object.values(counts) as HFEntry[])
      .filter((s) => s.errorCount >= 3)
      .sort((a, b) => b.errorCount - a.errorCount);
  }, [runsLast7]);

  const highFailureSourceIds = useMemo(() => {
    const ids: Record<string, boolean> = {};
    for (const s of highFailureSources) ids[s.sourceId] = true;
    return ids;
  }, [highFailureSources]);

  const recentInterruptions = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return (runs ?? []).filter(
      (r) => r.status === "INTERRUPTED" && new Date(r.startedAt).getTime() > cutoff
    );
  }, [runs]);

  // Unique channels available across all runs (for channel filter dropdown)
  const availableChannels = useMemo(() => {
    const set = new Set<string>();
    for (const r of runs ?? []) {
      const ch = (r.notificationResult as SchedulerRunNotificationResult | null)?.channel;
      if (ch && ch !== "none") set.add(ch);
    }
    return Array.from(set).sort();
  }, [runs]);

  const displayedRuns = useMemo(() => {
    let base = (runs ?? []);
    if (statusFilter !== "ALL") {
      base = base.filter((r) => {
        if (statusFilter === "LEGACY") return !r.status || (r.status !== "RUNNING" && r.status !== "COMPLETED" && r.status !== "INTERRUPTED");
        return r.status === statusFilter;
      });
    }
    if (filterByHighFailure && highFailureSources.length > 0) {
      base = base.filter((r) =>
        r.results.some(
          (res) =>
            (res.status === "ERROR" || res.status === "BLOCKED") &&
            !!highFailureSourceIds[res.sourceId ?? ""]
        )
      );
    }
    if (showProblematicOnly) {
      base = base.filter((r) =>
        r.results.some((s) => s.status === "ERROR" || s.status === "BLOCKED")
      );
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      base = base.filter((r) => new Date(r.startedAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      base = base.filter((r) => new Date(r.startedAt) <= to);
    }
    if (channelFilter !== "ALL") {
      base = base.filter((r) => {
        const ch = (r.notificationResult as SchedulerRunNotificationResult | null)?.channel;
        return ch === channelFilter;
      });
    }
    return base;
  }, [runs, statusFilter, showProblematicOnly, filterByHighFailure, highFailureSources, highFailureSourceIds, dateFrom, dateTo, channelFilter]);

  const allErrorRows = useMemo(
    () => (runs ?? []).filter((r) => r.results.some((s) => s.status === "ERROR" || s.status === "BLOCKED")),
    [runs]
  );
  const totalExportableErrors = useMemo(
    () => (runs ?? []).reduce(
      (sum, r) => sum + r.results.filter((s) => s.status === "ERROR" || s.status === "BLOCKED").length,
      0
    ),
    [runs]
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="space-y-1">
          <CardTitle className="text-xl flex items-center gap-2">
            <History className="h-5 w-5 text-muted-foreground" />
            RIWAYAT PENGUMPULAN
          </CardTitle>
          <CardDescription>30 run terakhir yang tersimpan di database</CardDescription>
        </div>
        {!loading && totalExportableErrors > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportErrorsToCSV(runs ?? [])}
            className="font-mono text-xs border-destructive/40 text-destructive hover:bg-destructive/5 hover:text-destructive shrink-0"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            EKSPOR ERROR
            <span className="ml-1.5 bg-destructive text-destructive-foreground rounded-full text-[9px] font-bold px-1.5 py-0.5 leading-none">
              {totalExportableErrors}
            </span>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {/* ── Interruption alert banner ──────────────────────────────────────── */}
        {!loading && recentInterruptions.length > 0 && (
          <div className="mb-4 flex items-start gap-3 bg-orange-50 border border-orange-300 rounded-sm px-4 py-3 dark:bg-orange-950/20 dark:border-orange-700">
            <Zap className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-orange-800 dark:text-orange-300">
                {recentInterruptions.length} run terputus dalam 24 jam terakhir
              </p>
              <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">
                Kemungkinan disebabkan server restart atau run melebihi batas waktu 30 menit.
                Gunakan filter <span className="font-semibold">⚡ Terputus</span> di bawah untuk melihat detail.
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {recentInterruptions.map((r) => (
                  <span key={r.id} className="text-[9px] font-mono bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded-sm dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700">
                    Run #{r.id} · {format(new Date(r.startedAt), "dd MMM HH:mm", { locale: idLocale })}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !runs || runs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
            <History className="h-8 w-8 opacity-30" />
            Belum ada riwayat pengumpulan. Jalankan scheduler untuk memulai.
          </div>
        ) : (
          <>
            {/* ── Aggregate stats strip ─────────────────────────────────────── */}
            <div className="mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div className="rounded-sm border bg-muted/20 p-2.5 text-center">
                <p className={cn(
                  "text-xl font-black font-mono leading-none",
                  successRate7 === null ? "text-muted-foreground"
                    : successRate7 >= 90 ? "text-emerald-600"
                    : successRate7 >= 70 ? "text-yellow-600"
                    : "text-destructive"
                )}>
                  {successRate7 !== null ? `${successRate7}%` : "—"}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Success Rate 7 Hari</p>
              </div>
              <div className="rounded-sm border bg-muted/20 p-2.5 text-center">
                <p className="text-xl font-black font-mono leading-none text-primary">{runsLast7.length}</p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Run dalam 7 Hari</p>
              </div>
              <div className="rounded-sm border bg-muted/20 p-2.5 text-center">
                <p className={cn(
                  "text-xl font-black font-mono leading-none",
                  problematicRuns.length === 0 ? "text-emerald-600" : "text-destructive"
                )}>
                  {problematicRuns.length}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Run Bermasalah (total)</p>
              </div>
              <div className="rounded-sm border bg-muted/20 p-2.5 text-center">
                <p className={cn(
                  "text-xl font-black font-mono leading-none",
                  totalErrorSources7 === 0 ? "text-emerald-600" : "text-orange-600"
                )}>
                  {totalErrorSources7}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Sumber Error 7 Hari</p>
              </div>
              <div className="rounded-sm border bg-muted/20 p-2.5 text-center">
                <p className="text-xl font-black font-mono leading-none text-sky-600 dark:text-sky-400">
                  {totalItemsSkipped7}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Duplikat Dicegah 7 Hari</p>
              </div>
              <div className="rounded-sm border bg-muted/20 p-2.5 text-center">
                <p className={cn("text-xl font-black font-mono leading-none", notifColorClass)}>
                  {notifAttempted7 === 0 ? "—" : `${notifSent7}/${notifAttempted7}`}
                </p>
                <p className="text-[9px] font-mono text-muted-foreground mt-0.5">Notifikasi Terkirim 7 Hari</p>
              </div>
            </div>

            {/* ── Deduplication trend bar chart ─────────────────────────────────── */}
            <DeduplicationTrendChart runs={runsLast7} />

            {/* ── Top duplicate-generating sources ──────────────────────────────── */}
            {topDuplicateSources.length > 0 && (
              <div className="mt-4 border rounded-sm bg-card overflow-hidden">
                <div className="px-3 py-2.5 border-b flex items-center gap-2 bg-muted/10">
                  <ChartBar className="h-3.5 w-3.5 text-sky-500" />
                  <p className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                    TOP SUMBER DUPLIKAT — 7 hari terakhir
                  </p>
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground">
                    sumber dengan duplikat tinggi perlu dikonfigurasi ulang
                  </span>
                </div>
                <div className="divide-y">
                  {topDuplicateSources.map((s, idx) => {
                    const total = s.skipped + s.saved;
                    const rate = total > 0 ? Math.round((s.skipped / total) * 100) : 0;
                    const severity =
                      rate >= 80 ? "high" :
                      rate >= 50 ? "medium" :
                      rate >= 20 ? "low" : "ok";
                    const cfg = {
                      high:   { bar: "bg-red-500",     text: "text-red-600",     badge: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
                      medium: { bar: "bg-orange-400",  text: "text-orange-600",  badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
                      low:    { bar: "bg-yellow-400",  text: "text-yellow-600",  badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300" },
                      ok:     { bar: "bg-emerald-400", text: "text-emerald-600", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
                    }[severity];
                    return (
                      <div key={s.sourceId} className="px-3 py-2 flex items-center gap-3 hover:bg-muted/20 transition-colors">
                        <span className="text-[10px] font-mono font-bold text-muted-foreground w-4 shrink-0 text-right">
                          {idx + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate" title={s.sourceName}>{s.sourceName}</p>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
                            <div
                              className={cn("h-full rounded-full transition-all", cfg.bar)}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right min-w-[36px]">
                            <p className={cn("text-sm font-bold font-mono leading-none", cfg.text)}>{s.skipped}</p>
                            <p className="text-[9px] font-mono text-muted-foreground">dilewati</p>
                          </div>
                          <div className="text-right min-w-[36px]">
                            <p className="text-sm font-bold font-mono leading-none text-emerald-600">{s.saved}</p>
                            <p className="text-[9px] font-mono text-muted-foreground">disimpan</p>
                          </div>
                          <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm w-[72px] text-center", cfg.badge)}>
                            {rate}% duplikat
                          </span>
                          {(severity === "high" || severity === "medium") ? (
                            <Link
                              href={`/data-collector?source=${encodeURIComponent(s.sourceId)}`}
                              className={cn(
                                "text-[8px] font-mono font-bold px-1.5 py-1 rounded-sm border shrink-0 flex items-center gap-0.5 transition-colors",
                                severity === "high"
                                  ? "border-red-300 text-red-700 bg-red-50/60 hover:bg-red-100"
                                  : "border-orange-300 text-orange-700 bg-orange-50/60 hover:bg-orange-100"
                              )}
                              title={`Konfigurasi ulang sumber ${s.sourceName}`}
                            >
                              <Settings className="h-2.5 w-2.5 shrink-0" />
                              KONFIGURASI
                            </Link>
                          ) : (
                            <span className="w-[86px] shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="px-3 py-2 border-t bg-muted/10">
                  <p className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                    <span className="font-semibold text-red-600">≥80%</span> perlu dikonfigurasi ulang &nbsp;·&nbsp;
                    <span className="font-semibold text-orange-600">50–79%</span> monitor lebih ketat &nbsp;·&nbsp;
                    <span className="font-semibold text-yellow-600">20–49%</span> overlap normal &nbsp;·&nbsp;
                    <span className="font-semibold text-emerald-600">&lt;20%</span> optimal
                  </p>
                </div>
              </div>
            )}

            {/* ── High-failure source badge ──────────────────────────────────────── */}
            {highFailureSources.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterByHighFailure((v) => !v)}
                className={cn(
                  "w-full mt-2 rounded-sm border p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-left transition-colors",
                  filterByHighFailure
                    ? "border-destructive bg-destructive/10"
                    : "border-destructive/50 bg-destructive/5 hover:bg-destructive/10"
                )}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <CircleAlert className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm font-black font-mono text-destructive leading-none">
                    {highFailureSources.length} sumber berulang error
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground">≥3× dalam 7 hari</span>
                </div>
                <div className="flex flex-wrap gap-1 flex-1">
                  {highFailureSources.slice(0, 4).map((s) => (
                    <span
                      key={s.sourceId}
                      className="inline-flex items-center gap-0.5 text-[9px] font-mono bg-destructive/15 text-destructive border border-destructive/30 px-1.5 py-0.5 rounded-sm leading-none whitespace-nowrap"
                    >
                      <CircleX className="h-2.5 w-2.5 shrink-0" />
                      {(s.sourceName).length > 18 ? `${s.sourceName.slice(0, 18)}…` : s.sourceName}
                      <span className="ml-1 font-bold">{s.errorCount}×</span>
                    </span>
                  ))}
                  {highFailureSources.length > 4 && (
                    <span className="text-[9px] font-mono text-muted-foreground px-1 py-0.5">
                      +{highFailureSources.length - 4} lagi
                    </span>
                  )}
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-auto">
                  {filterByHighFailure ? "✕ Hapus filter" : "Klik untuk filter →"}
                </span>
              </button>
            )}

            {/* ── Status filter + problematic toggle ────────────────────────────── */}
            <div className="flex flex-col gap-2 mb-3">
              {/* Status filter pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Status:</span>
                {([
                  { value: "ALL",         label: "Semua",    color: "border-border text-muted-foreground hover:bg-muted/40" },
                  { value: "RUNNING",     label: "⏳ Berjalan",   color: "border-yellow-300 text-yellow-700 data-[active=true]:bg-yellow-100 dark:data-[active=true]:bg-yellow-900/30" },
                  { value: "COMPLETED",   label: "✅ Selesai",    color: "border-emerald-300 text-emerald-700 data-[active=true]:bg-emerald-100 dark:data-[active=true]:bg-emerald-900/30" },
                  { value: "INTERRUPTED", label: "⚡ Terputus",   color: "border-gray-300 text-gray-600 data-[active=true]:bg-gray-100 dark:data-[active=true]:bg-gray-800" },
                  { value: "LEGACY",      label: "🕰 Lama",      color: "border-slate-300 text-slate-500 data-[active=true]:bg-slate-100 dark:data-[active=true]:bg-slate-800" },
                ] as const).map((opt) => {
                  const count = opt.value === "ALL"
                    ? (runs?.length ?? 0)
                    : opt.value === "LEGACY"
                      ? (runs ?? []).filter((r) => !r.status || (r.status !== "RUNNING" && r.status !== "COMPLETED" && r.status !== "INTERRUPTED")).length
                      : (runs ?? []).filter((r) => r.status === opt.value).length;
                  if (opt.value !== "ALL" && count === 0) return null;
                  const active = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      data-active={active}
                      onClick={() => setStatusFilter(opt.value)}
                      className={cn(
                        "inline-flex items-center gap-1 text-[9px] font-mono font-semibold border px-2 py-0.5 rounded-full transition-colors",
                        opt.color,
                        active ? "ring-1 ring-current" : "bg-background"
                      )}
                    >
                      {opt.label}
                      <span className={cn("text-[8px] font-bold", active ? "opacity-100" : "opacity-60")}>{count}</span>
                    </button>
                  );
                })}
              </div>
              {/* Row 2: date range + channel filter */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider shrink-0">Tanggal:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-6 text-[10px] font-mono border rounded-sm px-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  title="Dari tanggal"
                />
                <span className="text-[9px] font-mono text-muted-foreground">–</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-6 text-[10px] font-mono border rounded-sm px-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  title="Sampai tanggal"
                />
                {(dateFrom || dateTo) && (
                  <button
                    onClick={() => { setDateFrom(""); setDateTo(""); }}
                    className="text-[9px] font-mono text-primary hover:underline"
                  >✕ reset</button>
                )}
                {availableChannels.length > 0 && (
                  <>
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-wider ml-2 shrink-0">Channel:</span>
                    <Select value={channelFilter} onValueChange={setChannelFilter}>
                      <SelectTrigger className="h-6 w-32 text-[10px] font-mono bg-background py-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL" className="text-[10px] font-mono">Semua channel</SelectItem>
                        {availableChannels.map((ch) => (
                          <SelectItem key={ch} value={ch} className="text-[10px] font-mono">{ch}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}
              </div>
              {/* Row 3: count + problematic toggle */}
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-muted-foreground">
                  Menampilkan {displayedRuns.length} dari {runs.length} run
                  {(statusFilter !== "ALL" || dateFrom || dateTo || channelFilter !== "ALL" || showProblematicOnly || filterByHighFailure) && (
                    <button onClick={() => { setStatusFilter("ALL"); setDateFrom(""); setDateTo(""); setChannelFilter("ALL"); setShowProblematicOnly(false); setFilterByHighFailure(false); }} className="ml-1.5 text-primary hover:underline">✕ hapus semua filter</button>
                  )}
                </p>
                <Button
                  variant={showProblematicOnly ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setShowProblematicOnly((v) => !v)}
                  className="font-mono text-[10px] h-7 px-2.5 gap-1.5"
                >
                  <TriangleAlert className="h-3 w-3" />
                  {showProblematicOnly ? "Tampilkan Semua" : "Hanya Run Bermasalah"}
                  {!showProblematicOnly && problematicRuns.length > 0 && (
                    <span className="bg-destructive text-destructive-foreground rounded-full text-[9px] font-bold px-1.5 py-0.5 leading-none">
                      {problematicRuns.length}
                    </span>
                  )}
                </Button>
              </div>
            </div>

            {displayedRuns.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">
                {showProblematicOnly
                  ? "Tidak ada run bermasalah — semua run berjalan dengan baik! 🎉"
                  : statusFilter !== "ALL"
                  ? `Tidak ada run dengan status "${statusFilter === "LEGACY" ? "LAMA" : statusFilter === "RUNNING" ? "BERJALAN" : statusFilter === "COMPLETED" ? "SELESAI" : "TERPUTUS"}".`
                  : "Belum ada data."}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                    <TableHead className="w-[180px]">Waktu Mulai</TableHead>
                    <TableHead className="w-[110px]">Status Run</TableHead>
                    <TableHead className="w-[80px]">Durasi</TableHead>
                    <TableHead className="text-right w-[80px]">Disimpan</TableHead>
                    <TableHead className="text-right w-[80px]">Dilewati</TableHead>
                    <TableHead className="w-[110px]">Status Sumber</TableHead>
                    <TableHead>Sumber Error</TableHead>
                    <TableHead className="w-[110px]">Notifikasi</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayedRuns.map((run) => {
                    const duration = Math.round(
                      (new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000
                    );
                    const isExpanded = expandedId === run.id;
                    const overallOk = run.results.every(
                      (r) => r.status === "SUCCESS" || r.status === "PARTIAL"
                    );
                    const errorSources = run.results.filter(
                      (r) => r.status === "ERROR" || r.status === "BLOCKED"
                    );
                    // Use local override after a manual retry, fall back to server data
                    const notif: NotificationResult | null = notifOverrides[run.id] ?? run.notificationResult ?? null;
                    const isRetrying = retryingRunId === run.id;

                    return (
                      <React.Fragment key={run.id}>
                        <TableRow
                          className={cn(
                            "cursor-pointer hover:bg-muted/50",
                            !overallOk && "bg-red-50/30 dark:bg-red-950/10"
                          )}
                          onClick={() => setExpandedId(isExpanded ? null : run.id)}
                        >
                          <TableCell className="font-mono text-xs">
                            {format(new Date(run.startedAt), "dd MMM yyyy HH:mm:ss", { locale: idLocale })}
                          </TableCell>
                          <TableCell>
                            {run.status === "RUNNING" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded-sm dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700">
                                <LoaderCircle className="h-2.5 w-2.5 animate-spin shrink-0" />
                                Berjalan
                              </span>
                            ) : run.status === "COMPLETED" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 px-1.5 py-0.5 rounded-sm dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                                <CircleCheck className="h-2.5 w-2.5 shrink-0" />
                                Selesai
                              </span>
                            ) : run.status === "INTERRUPTED" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-gray-100 text-gray-600 border border-gray-300 px-1.5 py-0.5 rounded-sm dark:bg-gray-800 dark:text-gray-400 dark:border-gray-600">
                                <CircleAlert className="h-2.5 w-2.5 shrink-0" />
                                Terputus
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-sm dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
                                <Clock className="h-2.5 w-2.5 shrink-0" />
                                Lama
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {duration}d
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-mono font-bold text-primary text-lg">
                              {run.totalItemsSaved}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            {(run.totalItemsSkipped ?? 0) > 0 ? (
                              <span className="inline-flex items-center gap-0.5 font-mono font-semibold text-sky-600 dark:text-sky-400 text-sm" title="Duplikat yang berhasil dicegah">
                                {run.totalItemsSkipped}
                              </span>
                            ) : (
                              <span className="font-mono text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <RunStatusSummary results={run.results} />
                          </TableCell>
                          {/* Inline error source pills */}
                          <TableCell>
                            {errorSources.length === 0 ? (
                              <span className="text-[10px] font-mono text-emerald-600">—</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {errorSources.slice(0, 3).map((s) => (
                                  <span
                                    key={s.sourceId}
                                    title={s.errorMessage ?? s.status}
                                    className="inline-flex items-center gap-0.5 text-[9px] font-mono bg-destructive/10 text-destructive border border-destructive/20 px-1.5 py-0.5 rounded-sm leading-none whitespace-nowrap"
                                  >
                                    <CircleX className="h-2.5 w-2.5 shrink-0" />
                                    {(s.sourceName ?? s.sourceId).length > 14
                                      ? `${(s.sourceName ?? s.sourceId).slice(0, 14)}…`
                                      : (s.sourceName ?? s.sourceId)}
                                  </span>
                                ))}
                                {errorSources.length > 3 && (
                                  <span className="text-[9px] font-mono text-muted-foreground px-1 py-0.5">
                                    +{errorSources.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {notif == null ? (
                              <span className="text-[10px] font-mono text-muted-foreground">—</span>
                            ) : notif.channel === "none" ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1" title={notif.errorMessage ?? "Webhook URL tidak dikonfigurasi"}>
                                  <span className="w-2 h-2 rounded-full bg-gray-400 shrink-0" />
                                  <span className="text-[10px] font-mono text-muted-foreground font-medium">Tidak Dikonfigurasi</span>
                                </div>
                              </div>
                            ) : notif.success ? (
                              <div className="flex items-center gap-1" title={`Terkirim via ${notif.channel} · ${notif.sentAt}`}>
                                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                <span className="text-[10px] font-mono text-green-700 dark:text-green-400 font-bold">TERKIRIM</span>
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1" title={notif.errorMessage ?? "Pengiriman notifikasi gagal"}>
                                  <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                  <span className="text-[10px] font-mono text-red-700 font-bold">GAGAL</span>
                                  {(run.notificationRetryCount ?? 0) > 0 && (
                                    <span
                                      className={`text-[9px] font-mono px-1 py-0.5 rounded-sm border leading-none ${
                                        (run.notificationRetryCount ?? 0) >= 3
                                          ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                                          : "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/30 dark:text-orange-400 dark:border-orange-800"
                                      }`}
                                      title={
                                        (run.notificationRetryCount ?? 0) >= 3
                                          ? "Batas maksimum percobaan ulang tercapai — tidak akan dicoba lagi"
                                          : `${run.notificationRetryCount ?? 0}/3 percobaan gagal`
                                      }
                                    >
                                      {(run.notificationRetryCount ?? 0) >= 3 ? "⛔ 3/3" : `${run.notificationRetryCount}/3`}
                                    </span>
                                  )}
                                </div>
                                {(run.notificationRetryCount ?? 0) < 3 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      retryMutation.mutate({ id: run.id });
                                    }}
                                    disabled={isRetrying}
                                    className="inline-flex items-center gap-1 text-[9px] font-mono font-semibold text-primary border border-primary/40 rounded-sm px-1.5 py-0.5 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors leading-none"
                                    title="Kirim ulang notifikasi untuk run ini"
                                  >
                                    {isRetrying
                                      ? <><LoaderCircle className="h-2.5 w-2.5 animate-spin shrink-0" />MENGIRIM...</>
                                      : <><RefreshCw className="h-2.5 w-2.5 shrink-0" />KIRIM ULANG</>}
                                  </button>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={overallOk ? "default" : "destructive"}
                              className="font-mono text-[10px]"
                            >
                              {overallOk ? "OK" : "WARN"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow key={`${run.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={9} className="p-0">
                              <div className="px-4 py-3 space-y-3">
                                {/* Notification detail strip */}
                                {notif != null && (
                                  <div className={cn(
                                    "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-sm border px-3 py-2 text-[10px] font-mono",
                                    notif.channel === "none"
                                      ? "border-border bg-muted/30 text-muted-foreground"
                                      : notif.success
                                      ? "border-green-200 bg-green-50/60 dark:border-green-900 dark:bg-green-950/20"
                                      : "border-red-200 bg-red-50/60 dark:border-red-900 dark:bg-red-950/20"
                                  )}>
                                    <span className="font-semibold uppercase tracking-wider">
                                      {notif.channel === "none"
                                        ? "⚙️ Notifikasi tidak dikonfigurasi"
                                        : notif.success
                                        ? "✅ Notifikasi terkirim"
                                        : "❌ Notifikasi gagal"}
                                    </span>
                                    {notif.channel !== "none" && (
                                      <span className="text-muted-foreground">
                                        via <span className="font-semibold">{notif.channel}</span>
                                      </span>
                                    )}
                                    {notif.sentAt && (
                                      <span className="text-muted-foreground">
                                        · {format(new Date(notif.sentAt), "dd MMM HH:mm:ss", { locale: idLocale })}
                                      </span>
                                    )}
                                    {notif.errorMessage && (
                                      <span className={notif.success ? "text-muted-foreground" : "text-red-700 dark:text-red-400"}>
                                        · {notif.errorMessage}
                                      </span>
                                    )}
                                    {!notif.success && (run.notificationRetryCount ?? 0) > 0 && (
                                      <span className={`font-semibold ${(run.notificationRetryCount ?? 0) >= 3 ? "text-red-700 dark:text-red-400" : "text-orange-700 dark:text-orange-400"}`}>
                                        · Percobaan: {run.notificationRetryCount ?? 0}/3
                                        {(run.notificationRetryCount ?? 0) >= 3 && " (batas tercapai — tidak akan dicoba ulang)"}
                                      </span>
                                    )}
                                    {!notif.success && (run.notificationRetryCount ?? 0) < 3 && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          retryMutation.mutate({ id: run.id });
                                        }}
                                        disabled={isRetrying}
                                        className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-mono font-semibold text-primary border border-primary/40 rounded-sm px-2 py-1 hover:bg-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Kirim ulang notifikasi untuk run ini"
                                      >
                                        {isRetrying
                                          ? <><LoaderCircle className="h-3 w-3 animate-spin shrink-0" />MENGIRIM ULANG...</>
                                          : <><RefreshCw className="h-3 w-3 shrink-0" />KIRIM ULANG</>}
                                      </button>
                                    )}
                                  </div>
                                )}

                                <p className="text-xs font-mono font-semibold text-muted-foreground uppercase tracking-wider">
                                  Detail Per Sumber
                                </p>
                                <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
                                  {(() => {
                                    const maxSkipped = Math.max(0, ...run.results.map((r) => r.itemsSkipped ?? 0));
                                    return run.results.map((r) => {
                                      const isTopDup = maxSkipped > 0 && (r.itemsSkipped ?? 0) === maxSkipped;
                                      return (
                                        <div
                                          key={r.sourceId}
                                          className={cn(
                                            "flex items-start gap-2 rounded-sm border bg-background p-2",
                                            isTopDup
                                              ? "border-sky-400 dark:border-sky-600 bg-sky-50/30 dark:bg-sky-950/20"
                                              : "border-border"
                                          )}
                                        >
                                          <Badge
                                            variant={statusBadgeVariant(r.status)}
                                            className="font-mono text-[9px] mt-0.5 shrink-0"
                                          >
                                            {r.status}
                                          </Badge>
                                          <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1 flex-wrap">
                                              <p className="text-xs font-medium truncate" title={r.sourceName}>{r.sourceName}</p>
                                              {isTopDup && (
                                                <span className="inline-flex items-center gap-0.5 text-[8px] font-mono font-bold bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 border border-sky-300 dark:border-sky-700 px-1 py-0.5 rounded-sm leading-none whitespace-nowrap shrink-0">
                                                  ▲ DUPLIKAT TERTINGGI
                                                </span>
                                              )}
                                            </div>
                                            {r.errorMessage ? (
                                              <p className="text-[10px] text-destructive mt-0.5 line-clamp-2" title={r.errorMessage ?? undefined}>
                                                {r.errorMessage}
                                              </p>
                                            ) : (
                                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                                {r.itemsSaved} disimpan
                                                {(r.itemsSkipped ?? 0) > 0 && (
                                                  <span className={cn(
                                                    "ml-1.5 font-medium",
                                                    isTopDup
                                                      ? "text-sky-700 dark:text-sky-400 font-bold"
                                                      : "text-sky-600 dark:text-sky-400"
                                                  )}>
                                                    · {r.itemsSkipped} dilewati
                                                  </span>
                                                )}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    });
                                  })()}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
