// ─── KnowledgeSourcesBar ──────────────────────────────────────────────────────
//
// Strip kecil yang muncul di bawah header setiap halaman intelijen,
// menunjukkan Knowledge Assets dan AI Agents yang mendukung konten halaman ini.
// Klik untuk expand ke panel detail dengan link ke MKR penuh.

import { useState } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import {
  KNOWLEDGE_REGISTRY, AI_AGENTS_REGISTRY,
  INTEGRATION_LEVEL_COLOR,
  type IntegrationLevel,
} from "@/lib/knowledgeRegistry";
import { PAGE_KNOWLEDGE_CONFIG } from "@/lib/knowledge-sources-config";
import {
  BookOpen, Brain, ChevronDown, ChevronRight, Cpu,
  Database, ExternalLink, Shield, TrendingUp, Zap,
} from "lucide-react";

const LEVEL_ICON: Record<IntegrationLevel, React.ElementType> = {
  1: BookOpen,
  2: Shield,
  3: TrendingUp,
  4: Brain,
};

const LEVEL_DOT: Record<IntegrationLevel, string> = {
  1: "bg-slate-400",
  2: "bg-blue-500",
  3: "bg-emerald-500",
  4: "bg-primary",
};

const MATURITY_STYLE = {
  PRODUKSI: "bg-emerald-100 text-emerald-700 border-emerald-300",
  BETA: "bg-blue-100 text-blue-700 border-blue-300",
  ROADMAP: "bg-slate-100 text-slate-600 border-slate-300",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface KnowledgeSourcesBarProps {
  pageKey: keyof typeof PAGE_KNOWLEDGE_CONFIG;
  className?: string;
}

export function KnowledgeSourcesBar({ pageKey, className }: KnowledgeSourcesBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const config = PAGE_KNOWLEDGE_CONFIG[pageKey];
  if (!config) return null;

  const agents = AI_AGENTS_REGISTRY.filter((a) => config.agentIds.includes(a.agentId));

  // Collect all source IDs: agent mandatory + agent optional + extra
  const allSourceIds = Array.from(new Set([
    ...agents.flatMap((a) => a.sourceDependencies),
    ...agents.flatMap((a) => a.sourceOptional),
    ...(config.extraSourceIds ?? []),
  ]));

  const allSources = KNOWLEDGE_REGISTRY.filter((s) => allSourceIds.includes(s.sourceId));
  const mandatorySources = KNOWLEDGE_REGISTRY.filter((s) =>
    agents.some((a) => a.sourceDependencies.includes(s.sourceId))
  );

  // Compact stats
  const apiCount = allSources.filter((s) => s.apiAvailable !== "TIDAK").length;
  const liveCount = allSources.filter((s) => s.crawlingStatus === "AKTIF").length;
  const avgBV = allSources.length
    ? Math.round(allSources.reduce((sum, s) => sum + s.businessValue, 0) / allSources.length * 10) / 10
    : 0;

  return (
    <div className={cn("border rounded-sm overflow-hidden", className)}>
      {/* Collapsed strip */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-3 py-2 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
      >
        {/* Pulse dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>

        {/* Label */}
        <span className="text-xs text-primary font-mono font-semibold flex-1">
          Didukung oleh{" "}
          <strong>{allSources.length} Knowledge Assets</strong>
          {" · "}
          <strong>{agents.length} AI Agent{agents.length > 1 ? "s" : ""}</strong>
          {" · "}
          {liveCount} crawler aktif
        </span>

        {/* Agent chips */}
        <div className="hidden sm:flex items-center gap-1.5">
          {agents.map((a) => (
            <span
              key={a.agentId}
              className={cn(
                "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-sm border",
                MATURITY_STYLE[a.maturity]
              )}
            >
              <Cpu className="h-2.5 w-2.5 inline mr-0.5 -mt-0.5" />
              {a.nama}
            </span>
          ))}
        </div>

        {/* Toggle */}
        {isOpen
          ? <ChevronDown className="h-3.5 w-3.5 text-primary shrink-0" />
          : <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />
        }
      </button>

      {/* Expanded panel */}
      {isOpen && (
        <div className="border-t p-4 bg-card flex flex-col gap-4">
          {/* Agents */}
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
              <Cpu className="h-3 w-3" />AI Agents aktif di halaman ini
            </p>
            <div className="flex flex-col gap-2">
              {agents.map((agent) => (
                <div key={agent.agentId} className={cn("border rounded-sm p-3", MATURITY_STYLE[agent.maturity])}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[10px] font-mono text-muted-foreground">{agent.agentId}</span>
                        <span className={cn("text-[10px] font-mono px-1 rounded-sm border", MATURITY_STYLE[agent.maturity])}>
                          {agent.maturity}
                        </span>
                      </div>
                      <p className="font-semibold text-xs">{agent.nama}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{agent.tujuan}</p>
                    </div>
                    <span className="font-mono font-bold text-sm shrink-0">{agent.businessValue}/10</span>
                  </div>
                  {/* Agent outputs */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {agent.outputUtama.map((o, i) => (
                      <span key={i} className="text-[10px] bg-background/60 border rounded-sm px-1.5 py-0.5">
                        <Zap className="h-2.5 w-2.5 inline mr-0.5 text-primary" />{o}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Knowledge Assets */}
          <div>
            <p className="text-[10px] font-mono font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
              <Database className="h-3 w-3" />Knowledge Assets ({allSources.length})
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {mandatorySources.map((s) => {
                const LIcon = LEVEL_ICON[s.integrationLevel];
                return (
                  <Link key={s.sourceId} href={`/knowledge-registry?source=${encodeURIComponent(s.sourceId)}`}>
                   <a
                     className="flex items-center gap-2 border rounded-sm px-2 py-1.5 bg-red-50/20 border-red-200 hover:bg-red-50 hover:border-red-300 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                     title={`Buka ${s.nama} di Master Knowledge Registry`}
                     aria-label={`Buka ${s.nama} di Master Knowledge Registry`}
                   >
                    <span className={cn("h-2 w-2 rounded-full shrink-0", LEVEL_DOT[s.integrationLevel])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={s.nama}>{s.nama}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{s.sourceId}</p>
                    </div>
                    <span className="text-[10px] bg-red-100 text-red-700 rounded-sm px-1 font-mono shrink-0">wajib</span>
                   </a>
                  </Link>
                );
              })}
              {allSources
                .filter((s) => !mandatorySources.find((m) => m.sourceId === s.sourceId))
                .map((s) => (
                  <Link key={s.sourceId} href={`/knowledge-registry?source=${encodeURIComponent(s.sourceId)}`}>
                   <a
                     className="flex items-center gap-2 border rounded-sm px-2 py-1.5 bg-muted/20 hover:bg-muted/60 hover:border-primary/30 transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 outline-none"
                     title={`Buka ${s.nama} di Master Knowledge Registry`}
                     aria-label={`Buka ${s.nama} di Master Knowledge Registry`}
                   >
                    <span className={cn("h-2 w-2 rounded-full shrink-0", LEVEL_DOT[s.integrationLevel])} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" title={s.nama}>{s.nama}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{s.sourceId}</p>
                    </div>
                    <span className="text-[10px] bg-blue-100 text-blue-600 rounded-sm px-1 font-mono shrink-0">opsional</span>
                   </a>
                  </Link>
                ))}
            </div>
          </div>

          {/* Footer stats + link */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t">
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Sumber dengan API", val: apiCount },
                { label: "Crawler aktif", val: liveCount },
                { label: "Avg. Business Value", val: `${avgBV}/10` },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="font-mono font-bold text-sm text-primary">{stat.val}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>
            <Link href="/knowledge-registry">
              <a className="flex items-center gap-1 text-xs text-primary font-mono hover:underline">
                <Database className="h-3.5 w-3.5" />
                Buka Master Knowledge Registry
                <ExternalLink className="h-3 w-3 ml-0.5" />
              </a>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
