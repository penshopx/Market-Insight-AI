import { useState, useEffect, useRef } from "react";
import { useListContractors, useListTenderOpportunities, useListPainPoints, useListResearchItems } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Database, 
  HardHat, 
  ShieldCheck, 
  Briefcase, 
  Crosshair,
  Bell,
  Search,
  Settings,
  Globe,
  Layers,
  Cpu,
  TrendingUp,
  FileSignature,
  Wrench,
  Lightbulb,
  Shield,
  Eye,
  BarChart3,
  BookOpen,
  BellRing,
  Sparkles,
  LogOut,
  Zap,
  Mountain,
  Leaf,
  Award,
  CircleHelp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// ─── Global nav search with Ctrl+K shortcut ──────────────────────────────────
const ALL_NAV_ITEMS = [
  { title: "Dashboard Harian", href: "/" },
  { title: "Legalitas & Perijinan", href: "/regulasi" },
  { title: "SBU", href: "/kontraktor" },
  { title: "SKK", href: "/skk" },
  { title: "Tender", href: "/tender" },
  { title: "Proyek", href: "/riset" },
  { title: "Laporan Intelijen", href: "/laporan-intelijen" },
  { title: "Workroom", href: "/workroom" },
  { title: "Data Sumber", href: "/data-collector" },
  { title: "Surat Penawaran", href: "/surat-penawaran" },
  { title: "Notifikasi Briefing", href: "/pengaturan-notifikasi" },
];

function GlobalSearchInput() {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [, navigate] = useLocation();
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");

  const matches = value.trim()
    ? ALL_NAV_ITEMS.filter(n => n.title.toLowerCase().includes(value.toLowerCase()))
    : [];

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const prevFocusRef = useRef<Element | null>(null);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      if (prevFocusRef.current instanceof HTMLElement) prevFocusRef.current.focus();
      return;
    }
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, matches.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); navigate(`${base}${matches[activeIdx].href}`); setValue(""); setOpen(false); }
  };

  const listboxId = "global-search-listbox";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Cari halaman"
        aria-expanded={open && matches.length > 0}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-activedescendant={open && matches.length > 0 ? `gs-opt-${activeIdx}` : undefined}
        value={value}
        onChange={e => { setValue(e.target.value); setActiveIdx(0); setOpen(true); }}
        onFocus={() => { prevFocusRef.current = document.activeElement; if (value) setOpen(true); }}
        onKeyDown={handleKey}
        placeholder="Cari halaman…  Ctrl+K"
        className="h-9 w-64 rounded-sm border border-input bg-background pl-9 pr-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
      />
      {open && matches.length > 0 && (
        <div
          id={listboxId}
          ref={dropdownRef}
          role="listbox"
          aria-label="Hasil pencarian halaman"
          className="absolute top-full mt-1 left-0 w-full z-50 rounded-sm border bg-background shadow-md overflow-hidden"
        >
          {matches.slice(0, 6).map((item, i) => (
            <button
              key={item.href}
              id={`gs-opt-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              className={`w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 transition-colors ${i === activeIdx ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onMouseEnter={() => setActiveIdx(i)}
              onMouseDown={e => { e.preventDefault(); navigate(`${base}${item.href}`); setValue(""); setOpen(false); }}
            >
              <Search className="h-3 w-3 shrink-0 opacity-50" />
              {item.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { title: "Dashboard Harian", href: "/", icon: LayoutDashboard },
  { title: "Legalitas & Perijinan", href: "/regulasi", icon: Shield },
  { title: "SBU", href: "/kontraktor", icon: HardHat },
  { title: "SKK", href: "/skk", icon: ShieldCheck },
  { title: "Tender", href: "/tender", icon: Briefcase },
  { title: "Proyek", href: "/riset", icon: Database },
];

const intelNavItems: NavItem[] = [
  { title: "Laporan Intelijen", href: "/laporan-intelijen", icon: Sparkles },
  { title: "Data Sumber", href: "/data-collector", icon: Globe },
];

const teamNavItems: NavItem[] = [
  { title: "Workroom", href: "/workroom", icon: Wrench },
  { title: "Surat Penawaran", href: "/surat-penawaran", icon: FileSignature },
  { title: "Notifikasi Briefing", href: "/pengaturan-notifikasi", icon: BellRing },
];

function LogoutButton() {
  const { logout } = useAuth();
  const [busy, setBusy] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  async function handleLogout() {
    setBusy(true);
    await logout();
  }

  if (confirmLogout) {
    return (
      <span className="flex items-center gap-2">
        <button
          autoFocus
          onBlur={() => setConfirmLogout(false)}
          onClick={handleLogout}
          disabled={busy}
          className="text-xs font-mono text-destructive hover:underline"
        >
          ✓ Yakin keluar?
        </button>
        <button onClick={() => setConfirmLogout(false)} className="text-xs font-mono text-muted-foreground hover:text-foreground">Batal</button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirmLogout(true)}
      disabled={busy}
      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-sm text-xs font-mono text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5 shrink-0" />
      {busy ? "Keluar..." : "Keluar dari Platform"}
    </button>
  );
}

/** Lightweight nav counts for key Modul Operasi pages */
function useNavCounts(): Record<string, number> {
  const { data: contractors } = useListContractors();
  const { data: tenders } = useListTenderOpportunities();
  const { data: painPoints } = useListPainPoints();
  const { data: research } = useListResearchItems();
  return {
    "/kontraktor": contractors?.length ?? 0,
    "/tender": tenders?.length ?? 0,
    "/pain-points": painPoints?.length ?? 0,
    "/riset": research?.length ?? 0,
  };
}

/** #76 — reads the KRITIS count written by DecisionIntelligenceWidget */
function useKritisCount(): number {
  const [count, setCount] = useState<number>(() => {
    try { return parseInt(localStorage.getItem("mkp-kritis-count") ?? "0", 10) || 0; } catch { return 0; }
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === "mkp-kritis-count") setCount(parseInt(e.newValue ?? "0", 10) || 0);
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);
  return count;
}

const SHORTCUTS = [
  { key: "/", label: "Fokus kolom pencarian" },
  { key: "n", label: "Buat entri baru" },
  { key: "Esc", label: "Tutup dialog / batalkan" },
];

function KeyboardHelpButton() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "?" && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (e.target as HTMLElement).isContentEditable) return;
        if (document.querySelector("[role='dialog'][data-state='open']")) return;
        setOpen(v => !v);
      }
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="p-2 text-muted-foreground hover:text-foreground"
        title="Pintasan keyboard (?)"
      >
        <CircleHelp className="h-5 w-5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-sm border bg-popover shadow-lg p-3 text-sm">
          <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase mb-2">Pintasan Keyboard</p>
          <table className="w-full text-xs">
            <tbody>
              {SHORTCUTS.map(s => (
                <tr key={s.key} className="border-b border-border/40 last:border-0">
                  <td className="py-1.5 pr-3 font-mono">
                    <kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px]">{s.key}</kbd>
                  </td>
                  <td className="py-1.5 text-muted-foreground">{s.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { authEnabled } = useAuth();
  const kritisCount = useKritisCount();
  const navCounts = useNavCounts();

  return (
    <div className="flex min-h-[100dvh] w-full flex-col bg-background md:flex-row">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 z-10 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <span>INTEL-KONSTRUKSI</span>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto py-4">
          <div className="px-4 text-xs font-mono font-medium text-sidebar-foreground/50 mb-2 uppercase tracking-wider">
            Modul Operasi
          </div>
          <nav className="space-y-1 px-3">
            {navItems.map((item) => {
              const isActive = location === item.href;
              const showKritis = item.href === "/" && kritisCount > 0;
              const navCount = navCounts[item.href] ?? 0;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-primary" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.title}</span>
                    {showKritis && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white leading-none">
                        {kritisCount}
                      </span>
                    )}
                    {!showKritis && navCount > 0 && (
                      <span className="flex h-4 min-w-4 items-center justify-center rounded-sm bg-sidebar-accent text-sidebar-foreground/60 px-1 text-[9px] font-mono leading-none">
                        {navCount}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </nav>
          
          <div className="px-4 text-xs font-mono font-medium text-sidebar-foreground/50 mt-6 mb-2 uppercase tracking-wider">
            Intelijen Pasar
          </div>
          <nav className="space-y-1 px-3">
            {intelNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-primary" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </div>
                </Link>
              );
            })}
          </nav>

          <div className="px-4 text-xs font-mono font-medium text-sidebar-foreground/50 mt-6 mb-2 uppercase tracking-wider">
            Tim Perumusan
          </div>
          <nav className="space-y-1 px-3">
            {teamNavItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <div
                    aria-current={isActive ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                      isActive 
                        ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-4 border-primary" 
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground border-l-4 border-transparent"
                    }`}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </div>
                </Link>
              );
            })}
          </nav>

        </div>
        
        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-sm bg-sidebar-accent flex items-center justify-center text-primary font-bold font-mono">
              DIR
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold">Direktur Marketing</span>
              <span className="text-xs text-sidebar-foreground/60 font-mono">07:00 BRIEFING</span>
            </div>
          </div>
          {authEnabled && <LogoutButton />}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex flex-1 flex-col md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
          <div className="flex items-center gap-4 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center bg-primary text-primary-foreground">
              <HardHat className="h-5 w-5" />
            </div>
            <span className="font-bold tracking-tight">INTEL-KONSTRUKSI</span>
          </div>
          
          <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <span>STATUS:</span>
            <span className="flex items-center gap-1.5 text-primary">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
              </span>
              SINKRONISASI AKTIF
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative hidden md:block">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <GlobalSearchInput />
            </div>
            <button className="relative p-2 text-muted-foreground hover:text-foreground" aria-label="Notifikasi">
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 flex h-2 w-2 rounded-full bg-destructive"></span>
            </button>
            <KeyboardHelpButton />
            <a href={`${import.meta.env.BASE_URL}pengaturan-notifikasi`} className="p-2 text-muted-foreground hover:text-foreground" title="Pengaturan Notifikasi" aria-label="Pengaturan Notifikasi">
              <Settings className="h-5 w-5" />
            </a>
          </div>
        </header>

        <main className="flex-1 overflow-auto bg-muted/30 p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
