import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Mail,
  MessageCircle,
  Plus,
  Trash2,
  Send,
  CircleCheck,
  CircleX,
  TriangleAlert,
  Settings,
  ToggleLeft,
  ToggleRight,
  LoaderCircle,
  Lock,
  KeyRound,
  History,
  FileText,
  ClipboardList,
  Eye,
  Building,
  MapPin,
  Bell,
  BellOff,
  Zap,
} from "lucide-react";

const API = import.meta.env.BASE_URL.replace(/\/$/, "");
const TOKEN_KEY = "notification_admin_token";

// ── Types ──────────────────────────────────────────────────────────────────────

interface NotificationSetting {
  id: number;
  channel: "email" | "whatsapp";
  recipient: string;
  label: string;
  enabled: boolean;
  createdAt: string;
}

interface ConfigStatus {
  email: boolean;
  whatsapp: boolean;
}

interface DeliveryResult {
  recipient: string;
  success: boolean;
  error?: string;
}

interface TestSendReport {
  pdfGenerated: boolean;
  intelligencePdfGenerated?: boolean;
  emailResults: DeliveryResult[];
  whatsappResults: DeliveryResult[];
  error?: string;
}

interface DeliveryLogEntry {
  id: number;
  deliveryDate: string;
  channel: string;
  recipient: string;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

interface PbgSubscription {
  id: number;
  whatsapp: string;
  label: string;
  cities: string[];
  enabled: boolean;
  createdAt: string;
}

interface PbgAlertReport {
  checkedSubscribers: number;
  pbgItemsFound: number;
  alertsSent: number;
  alertsFailed: number;
}

interface BriefingDelivery {
  id: number;
  deliveryDate: string;
  status: string;
  pdfGenerated: boolean;
  successCount: number;
  failCount: number;
  error: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── API helpers ───────────────────────────────────────────────────────────────

function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? "";
}

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
      ...init?.headers,
    },
    ...init,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ── Token Gate ────────────────────────────────────────────────────────────────

function TokenGate({ onAuthenticated }: { onAuthenticated: (token: string) => void }) {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setChecking(true);
    setError("");
    try {
      // Verify token by calling config-status
      await apiFetch<ConfigStatus>("/notification-settings/config-status", input.trim());
      localStorage.setItem(TOKEN_KEY, input.trim());
      onAuthenticated(input.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Token tidak valid");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Akses Admin Diperlukan</h1>
            <p className="text-sm text-muted-foreground font-mono">Pengaturan Notifikasi</p>
          </div>
        </div>

        <div className="rounded-sm border bg-card p-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Halaman ini dilindungi. Masukkan <code className="text-xs bg-muted px-1 py-0.5 rounded">NOTIFICATION_ADMIN_TOKEN</code> yang dikonfigurasi di environment server.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-mono text-muted-foreground">Admin Token</label>
              <div className="relative">
                <KeyRound className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Masukkan token…"
                  className="h-9 w-full rounded-sm border border-input bg-background pl-9 pr-4 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  autoFocus
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive font-mono">{error}</p>
            )}

            <button
              type="submit"
              disabled={checking || !input.trim()}
              className="w-full h-9 bg-primary text-primary-foreground font-mono text-sm rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {checking ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Masuk
            </button>
          </form>
        </div>

        <div className="rounded-sm border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700 font-mono">
            Token disimpan di browser (localStorage) untuk sesi ini. Set <code>NOTIFICATION_ADMIN_TOKEN</code> di environment variables server untuk mengaktifkan akses.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function PengaturanNotifikasi() {
  const [adminToken, setAdminToken] = useState<string | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);

  // Check for stored token on mount
  useEffect(() => {
    setAdminToken(getStoredToken() || null);
    setTokenChecked(true);
  }, []);

  if (!tokenChecked) return null;

  if (!adminToken) {
    return (
      <TokenGate
        onAuthenticated={(token) => setAdminToken(token)}
      />
    );
  }

  return (
    <SettingsPanel
      token={adminToken}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setAdminToken(null);
      }}
    />
  );
}

// ── Settings Panel ─────────────────────────────────────────────────────────────

function SettingsPanel({ token, onLogout }: { token: string; onLogout: () => void }) {
  const qc = useQueryClient();

  // #81 — persist preferred channel so the user doesn't re-select every session
  const CHANNEL_KEY = "mkp-notif-add-channel-v1";
  const [addChannel, setAddChannel] = useState<"email" | "whatsapp">(() => {
    const saved = localStorage.getItem(CHANNEL_KEY);
    return (saved === "email" || saved === "whatsapp") ? saved : "email";
  });
  const [addRecipient, setAddRecipient] = useState("");
  const [addLabel, setAddLabel] = useState("");

  // Persist channel preference whenever it changes
  useEffect(() => {
    localStorage.setItem(CHANNEL_KEY, addChannel);
  }, [addChannel]);
  const [testReport, setTestReport] = useState<TestSendReport | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const fetcher = <T,>(path: string, init?: RequestInit) => apiFetch<T>(path, token, init);

  const { data: settings = [], isLoading, error: settingsError } = useQuery<NotificationSetting[], Error>({
    queryKey: ["notification-settings", token],
    queryFn: () => fetcher("/notification-settings"),
    retry: false,
  });

  const { data: configStatus } = useQuery<ConfigStatus>({
    queryKey: ["notification-settings-config", token],
    queryFn: () => fetcher("/notification-settings/config-status"),
    retry: false,
  });

  const { data: deliveries = [], isLoading: deliveriesLoading } = useQuery<BriefingDelivery[]>({
    queryKey: ["briefing-deliveries"],
    queryFn: () => fetch(`${API}/api/scheduler/briefing/deliveries`).then((r) => r.json()),
    refetchInterval: 30_000,
  });

  const { data: deliveryLog = [], isLoading: logLoading } = useQuery<DeliveryLogEntry[]>({
    queryKey: ["briefing-delivery-log", token],
    queryFn: () => fetcher("/notification-settings/delivery-log"),
    retry: false,
    refetchInterval: 60_000,
  });

  // If the token stored in localStorage was revoked/wrong, log out
  useEffect(() => {
    if (settingsError?.message?.includes("Invalid admin token") || settingsError?.message?.includes("Missing Authorization")) {
      onLogout();
    }
  }, [settingsError, onLogout]);

  const addMutation = useMutation({
    mutationFn: (body: { channel: string; recipient: string; label: string }) =>
      fetcher<NotificationSetting>("/notification-settings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["notification-settings", token] });
      setAddRecipient("");
      setAddLabel("");
      toast.success("Penerima ditambahkan", { description: data.label ?? data.recipient ?? undefined, duration: 2000 });
    },
    onError: (err: unknown) => toast.error("Gagal menambah penerima", { description: err instanceof Error ? err.message : "Coba lagi" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      fetcher<NotificationSetting>(`/notification-settings/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (_data, { id, enabled }) => {
      const name = settings?.find(s => s.id === id)?.label ?? settings?.find(s => s.id === id)?.recipient;
      qc.invalidateQueries({ queryKey: ["notification-settings", token] });
      toast.success(enabled ? "Penerima diaktifkan" : "Penerima dinonaktifkan", { description: name ?? undefined, duration: 1800 });
    },
    onError: (err: unknown) => toast.error("Gagal mengubah status penerima", { description: err instanceof Error ? err.message : "Coba lagi" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetcher(`/notification-settings/${id}`, { method: "DELETE" }),
    onSuccess: (_data, id) => {
      const name = settings?.find(s => s.id === id)?.label ?? settings?.find(s => s.id === id)?.recipient;
      qc.invalidateQueries({ queryKey: ["notification-settings", token] });
      toast.success("Penerima dihapus", { description: name ?? undefined, duration: 2000 });
    },
    onError: (err: unknown) => toast.error("Gagal menghapus penerima", { description: err instanceof Error ? err.message : "Coba lagi" }),
  });

  const [confirmTest, setConfirmTest] = useState(false);

  const testMutation = useMutation({
    mutationFn: () =>
      fetcher<TestSendReport>("/notification-settings/test-send", { method: "POST" }),
    onSuccess: (data) => {
      setTestReport(data);
      qc.invalidateQueries({ queryKey: ["briefing-delivery-log", token] });
      // #149 — confirmation toast after successful re-send
      const successCount = [
        ...(data.emailResults ?? []),
        ...(data.whatsappResults ?? []),
      ].filter((r) => r.success).length;
      if (data.error) {
        toast.error("Pengiriman briefing gagal", { description: data.error });
      } else {
        toast.success("Briefing berhasil dikirim", {
          description: `${successCount} penerima menerima notifikasi`,
        });
      }
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : String(err);
      setTestReport({
        pdfGenerated: false,
        intelligencePdfGenerated: false,
        emailResults: [],
        whatsappResults: [],
        error: message,
      });
      toast.error("Pengiriman briefing gagal", { description: message });
    },
  });

  const handlePreviewPDF = async () => {
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await fetch(`${API}/api/briefing/preview`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error((err as { error?: string }).error ?? res.statusText);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      // Revoke after a short delay so the new tab has time to load
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : String(err));
    } finally {
      setPreviewLoading(false);
    }
  };

  const [addRecipientError, setAddRecipientError] = useState(false);
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addRecipient.trim()) { setAddRecipientError(true); return; }
    setAddRecipientError(false);
    addMutation.mutate({ channel: addChannel, recipient: addRecipient.trim(), label: addLabel.trim() });
  };

  const emailSettings = settings.filter((s) => s.channel === "email");
  const waSettings = settings.filter((s) => s.channel === "whatsapp");

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center bg-primary text-primary-foreground">
          <Settings className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">Pengaturan Notifikasi</h1>
          <p className="text-sm text-muted-foreground font-mono">
            Kelola penerima laporan briefing harian 07:00 WIB
          </p>
        </div>
        <button
          onClick={onLogout}
          className="text-xs font-mono text-muted-foreground hover:text-foreground border border-input px-3 py-1.5 rounded-sm"
          title="Keluar (hapus token dari browser)"
        >
          Keluar
        </button>
      </div>

      {/* Channel config status */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className={`rounded-sm border p-4 ${configStatus?.email ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center gap-2 mb-2">
            <Mail className="h-4 w-4" />
            <span className="font-mono text-sm font-bold">Email (SMTP)</span>
            {configStatus?.email ? (
              <CircleCheck className="h-4 w-4 text-green-600 ml-auto" />
            ) : (
              <TriangleAlert className="h-4 w-4 text-amber-600 ml-auto" />
            )}
          </div>
          {configStatus?.email ? (
            <p className="text-xs text-green-700">SMTP dikonfigurasi. Email siap dikirim.</p>
          ) : (
            <div className="text-xs text-amber-700 space-y-1">
              <p>SMTP belum dikonfigurasi. Set environment variable:</p>
              <code className="block bg-amber-100 p-1 rounded text-xs font-mono">
                SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
              </code>
            </div>
          )}
        </div>

        <div className={`rounded-sm border p-4 ${configStatus?.whatsapp ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"}`}>
          <div className="flex items-center gap-2 mb-2">
            <MessageCircle className="h-4 w-4" />
            <span className="font-mono text-sm font-bold">WhatsApp Cloud API</span>
            {configStatus?.whatsapp ? (
              <CircleCheck className="h-4 w-4 text-green-600 ml-auto" />
            ) : (
              <TriangleAlert className="h-4 w-4 text-amber-600 ml-auto" />
            )}
          </div>
          {configStatus?.whatsapp ? (
            <p className="text-xs text-green-700">WhatsApp Cloud API dikonfigurasi.</p>
          ) : (
            <div className="text-xs text-amber-700 space-y-1">
              <p>WhatsApp belum dikonfigurasi. Set environment variable:</p>
              <code className="block bg-amber-100 p-1 rounded text-xs font-mono">
                WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID
              </code>
            </div>
          )}
        </div>
      </div>

      {/* Add recipient form */}
      <div className="rounded-sm border bg-card p-4">
        <h2 className="font-mono text-sm font-bold mb-4 flex items-center gap-2">
          <Plus className="h-4 w-4" /> Tambah Penerima
        </h2>
        <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-mono text-muted-foreground">CHANNEL</label>
            <Select value={addChannel} onValueChange={v => setAddChannel(v as "email" | "whatsapp")}>
              <SelectTrigger className="h-9 w-36 text-sm font-mono bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email" className="text-sm font-mono">Email</SelectItem>
                <SelectItem value="whatsapp" className="text-sm font-mono">WhatsApp</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-48">
            <label className="text-xs font-mono text-muted-foreground">
              {addChannel === "email" ? "ALAMAT EMAIL" : "NOMOR WA (INTL, misal: 628123...)"}
            </label>
            <input
              type={addChannel === "email" ? "email" : "tel"}
              autoFocus
              value={addRecipient}
              onChange={(e) => { setAddRecipient(e.target.value); if (e.target.value.trim()) setAddRecipientError(false); }}
              onBlur={() => { if (!addRecipient.trim()) setAddRecipientError(true); }}
              placeholder={addChannel === "email" ? "direktur@perusahaan.com" : "628123456789"}
              className={`h-9 rounded-sm border bg-background px-3 text-sm font-mono focus:outline-none focus:ring-1 ${addRecipientError ? "border-red-500 focus:ring-red-500" : "border-input focus:border-primary focus:ring-primary"}`}
            />
            {addRecipientError && (
              <p className="text-xs text-red-600 font-mono mt-0.5">{addChannel === "email" ? "Alamat email wajib diisi" : "Nomor WA wajib diisi"}</p>
            )}
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-36">
            <label className="text-xs font-mono text-muted-foreground">LABEL (OPSIONAL)</label>
            <input
              type="text"
              value={addLabel}
              onChange={(e) => setAddLabel(e.target.value)}
              placeholder="misal: Direktur Marketing"
              className="h-9 rounded-sm border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={addMutation.isPending}
            className="h-9 px-4 bg-primary text-primary-foreground font-mono text-sm rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {addMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah
          </button>
        </form>
        {addMutation.isError && (
          <p className="mt-2 text-xs text-destructive font-mono">{(addMutation.error as Error)?.message}</p>
        )}
      </div>

      {/* Email recipients */}
      <RecipientSection
        title="PENERIMA EMAIL"
        icon={<Mail className="h-4 w-4" />}
        settings={emailSettings}
        isLoading={isLoading}
        onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
        onDelete={(id) => deleteMutation.mutate(id)}
        emptyLabel="Belum ada penerima email"
      />

      {/* WhatsApp recipients */}
      <RecipientSection
        title="PENERIMA WHATSAPP"
        icon={<MessageCircle className="h-4 w-4" />}
        settings={waSettings}
        isLoading={isLoading}
        onToggle={(id, enabled) => toggleMutation.mutate({ id, enabled })}
        onDelete={(id) => deleteMutation.mutate(id)}
        emptyLabel="Belum ada penerima WhatsApp"
      />

      {/* Daily briefing delivery summary */}
      <DeliveryHistorySection deliveries={deliveries} isLoading={deliveriesLoading} />

      {/* Preview PDF */}
      <div className="rounded-sm border bg-card p-4">
        <h2 className="font-mono text-sm font-bold mb-3 flex items-center gap-2">
          <Eye className="h-4 w-4" /> PREVIEW PDF BRIEFING
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Lihat isi PDF briefing hari ini di tab baru tanpa mengirim ke penerima manapun. Menggunakan data real dari database.
        </p>
        <button
          onClick={handlePreviewPDF}
          disabled={previewLoading}
          className="h-9 px-4 bg-secondary text-secondary-foreground font-mono text-sm rounded-sm hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2 border border-input"
        >
          {previewLoading ? (
            <><LoaderCircle className="h-4 w-4 animate-spin" /> Membuka PDF...</>
          ) : (
            <><Eye className="h-4 w-4" /> Preview PDF</>
          )}
        </button>
        {previewError && (
          <p className="mt-2 text-xs text-destructive font-mono">{previewError}</p>
        )}
      </div>

      {/* Test send */}
      <div className="rounded-sm border bg-card p-4">
        <h2 className="font-mono text-sm font-bold mb-3 flex items-center gap-2">
          <Send className="h-4 w-4" /> Test Kirim Sekarang
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          Generate dan kirim briefing PDF sekarang ke semua penerima yang aktif. Gunakan untuk memverifikasi konfigurasi.
        </p>
        {confirmTest ? (
          <span className="flex items-center gap-2">
            <button
              autoFocus
              onBlur={() => setConfirmTest(false)}
              onClick={() => { setConfirmTest(false); setTestReport(null); testMutation.mutate(); }}
              className="h-9 px-4 bg-primary text-primary-foreground font-mono text-sm rounded-sm hover:bg-primary/90 flex items-center gap-2"
            >
              <Send className="h-4 w-4" /> ✓ Yakin kirim?
            </button>
            <button onClick={() => setConfirmTest(false)} className="text-xs font-mono text-muted-foreground hover:text-foreground">Batal</button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmTest(true)}
            disabled={testMutation.isPending || settings.filter((s) => s.enabled).length === 0}
            className="h-9 px-4 bg-primary text-primary-foreground font-mono text-sm rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {testMutation.isPending ? (
              <><LoaderCircle className="h-4 w-4 animate-spin" /> Mengirim...</>
            ) : (
              <><Send className="h-4 w-4" /> Kirim Test</>
            )}
          </button>
        )}
        {settings.filter((s) => s.enabled).length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground font-mono">Aktifkan minimal satu penerima untuk test.</p>
        )}

        {/* Test results */}
        {testReport && (
          <div className="mt-4 rounded-sm border p-4 bg-muted/30">
            <p className="font-mono text-xs font-bold mb-3">HASIL PENGIRIMAN:</p>
            {testReport.error && (
              <div className="flex items-center gap-2 text-destructive text-sm mb-2">
                <CircleX className="h-4 w-4" />
                {testReport.error}
              </div>
            )}
            {!testReport.pdfGenerated && !testReport.error && (
              <p className="text-sm text-muted-foreground">Tidak ada penerima aktif.</p>
            )}
            {testReport.pdfGenerated && (
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <CircleCheck className="h-3 w-3 text-green-600" /> PDF berhasil digenerate
              </p>
            )}
            {testReport.pdfGenerated && (
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                {testReport.intelligencePdfGenerated ? (
                  <>
                    <CircleCheck className="h-3 w-3 text-green-600" /> Laporan Intelijen berhasil digenerate dan disertakan
                  </>
                ) : (
                  <>
                    <TriangleAlert className="h-3 w-3 text-amber-600" /> Laporan Intelijen tidak tersedia pada pengiriman ini
                  </>
                )}
              </p>
            )}
            {[...testReport.emailResults, ...testReport.whatsappResults].map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-sm py-1 border-b last:border-0">
                {r.success ? (
                  <CircleCheck className="h-4 w-4 text-green-600 flex-shrink-0" />
                ) : (
                  <CircleX className="h-4 w-4 text-destructive flex-shrink-0" />
                )}
                <span className="font-mono text-xs">{r.recipient}</span>
                {r.error && (
                  <span className="text-xs text-destructive ml-auto">{r.error}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-recipient delivery audit log */}
      <DeliveryHistoryPanel entries={deliveryLog} isLoading={logLoading} />

      {/* PBG City Alert Subscriptions */}
      <PbgSubscriptionsPanel token={token} />
    </div>
  );
}

// ── Delivery History (daily summary) ──────────────────────────────────────────

const STATUS_META: Record<string, { label: string; bg: string; text: string }> = {
  SUCCESS: { label: "Berhasil", bg: "bg-green-100", text: "text-green-700" },
  PARTIAL: { label: "Sebagian", bg: "bg-amber-100", text: "text-amber-700" },
  FAILED:  { label: "Gagal",    bg: "bg-red-100",   text: "text-red-700"   },
  PENDING: { label: "Pending",  bg: "bg-gray-100",  text: "text-gray-600"  },
};

function DeliveryHistorySection({
  deliveries,
  isLoading,
}: {
  deliveries: BriefingDelivery[];
  isLoading: boolean;
}) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    });
  };

  return (
    <div className="rounded-sm border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <History className="h-4 w-4" />
        <h2 className="font-mono text-sm font-bold">RIWAYAT PENGIRIMAN BRIEFING</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {deliveries.length} entri
        </span>
      </div>

      {isLoading ? (
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
              <div className="h-3 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-8" />
              <div className="h-3 bg-muted rounded w-8" />
              <div className="h-3 bg-muted rounded w-8" />
              <div className="h-3 bg-muted rounded w-24 ml-auto" />
            </div>
          ))}
        </div>
      ) : deliveries.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground font-mono">
          Belum ada riwayat pengiriman briefing
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b bg-muted/40 sticky top-0 z-10">
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Tanggal</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-2 text-center text-muted-foreground font-medium">PDF</th>
                <th className="px-4 py-2 text-center text-muted-foreground font-medium">Berhasil</th>
                <th className="px-4 py-2 text-center text-muted-foreground font-medium">Gagal</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Waktu Kirim</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {deliveries.map((d) => {
                const meta = STATUS_META[d.status] ?? STATUS_META.PENDING;
                return (
                  <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap font-bold">{d.deliveryDate}</td>
                    <td className="px-4 py-2.5">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${meta.bg} ${meta.text}`}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {d.pdfGenerated ? (
                        <FileText className="h-3.5 w-3.5 text-green-600 mx-auto" />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {d.successCount > 0 ? (
                        <span className="text-green-700 font-bold">{d.successCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {d.failCount > 0 ? (
                        <span className="text-red-600 font-bold">{d.failCount}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                      {fmt(d.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 max-w-48 truncate text-muted-foreground" title={d.error ?? undefined}>
                      {d.error ?? <span className="text-green-700">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Delivery History (per-recipient log) ──────────────────────────────────────

// #109 — DeliveryHistoryPanel with date + channel filter controls
function DeliveryHistoryPanel({
  entries,
  isLoading,
}: {
  entries: DeliveryLogEntry[];
  isLoading: boolean;
}) {
  // Filter state — changes trigger a re-fetch via the parent query (see SettingsPanel)
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterChannel, setFilterChannel] = useState<"" | "email" | "whatsapp">("");

  const filtered = entries.filter((e) => {
    if (filterChannel && e.channel !== filterChannel) return false;
    if (filterFrom && e.sentAt < filterFrom) return false;
    if (filterTo && e.sentAt > filterTo + "T23:59:59") return false;
    return true;
  });

  function formatSentAt(iso: string): string {
    try {
      return new Date(iso).toLocaleString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Jakarta",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="rounded-sm border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <ClipboardList className="h-4 w-4" />
        <h2 className="font-mono text-sm font-bold flex-1">LOG PENGIRIMAN PER PENERIMA</h2>
        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {filtered.length} entri
        </span>
      </div>

      {/* #109 — filter bar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 bg-muted/20">
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Filter:</span>
        <input
          type="date"
          value={filterFrom}
          onChange={(e) => setFilterFrom(e.target.value)}
          className="h-7 rounded-sm border border-input bg-background px-2 text-xs font-mono focus:border-primary focus:outline-none"
          title="Dari tanggal"
        />
        <span className="text-xs text-muted-foreground">–</span>
        <input
          type="date"
          value={filterTo}
          onChange={(e) => setFilterTo(e.target.value)}
          className="h-7 rounded-sm border border-input bg-background px-2 text-xs font-mono focus:border-primary focus:outline-none"
          title="Sampai tanggal"
        />
        <Select value={filterChannel || "__all__"} onValueChange={v => setFilterChannel(v === "__all__" ? "" : v as "" | "email" | "whatsapp")}>
          <SelectTrigger className="h-7 w-32 text-xs font-mono bg-background">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__" className="text-xs font-mono">Semua Channel</SelectItem>
            <SelectItem value="email" className="text-xs font-mono">Email</SelectItem>
            <SelectItem value="whatsapp" className="text-xs font-mono">WhatsApp</SelectItem>
          </SelectContent>
        </Select>
        {(filterFrom || filterTo || filterChannel) && (
          <button
            onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterChannel(""); }}
            className="text-[10px] font-mono text-destructive hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-3 animate-pulse">
              <div className="h-3 bg-muted rounded w-28" />
              <div className="h-3 bg-muted rounded w-32" />
              <div className="h-3 bg-muted rounded w-20" />
              <div className="h-3 bg-muted rounded w-24" />
              <div className="h-3 bg-muted rounded w-16" />
              <div className="h-3 bg-muted rounded w-28 ml-auto" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground font-mono flex flex-col items-center gap-2">
          <span>Belum ada riwayat pengiriman yang cocok dengan filter</span>
          {(filterFrom || filterTo || filterChannel) && (
            <button onClick={() => { setFilterFrom(""); setFilterTo(""); setFilterChannel(""); }} className="text-xs font-mono text-primary hover:underline">✕ Reset filter</button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b bg-muted/40 sticky top-0 z-10">
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Tanggal Kirim</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Briefing</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Channel</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Penerima</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Status</th>
                <th className="px-4 py-2 text-left text-muted-foreground font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-2 whitespace-nowrap text-muted-foreground">
                    {formatSentAt(entry.sentAt)}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">{entry.deliveryDate}</td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      {entry.channel === "email" ? (
                        <Mail className="h-3 w-3" />
                      ) : (
                        <MessageCircle className="h-3 w-3" />
                      )}
                      {entry.channel.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 max-w-[200px] truncate" title={entry.recipient}>
                    {entry.recipient}
                  </td>
                  <td className="px-4 py-2 whitespace-nowrap">
                    {entry.status === "SUCCESS" ? (
                      <span className="flex items-center gap-1 text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded w-fit">
                        <CircleCheck className="h-3 w-3" /> BERHASIL
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-destructive bg-red-50 border border-red-200 px-2 py-0.5 rounded w-fit">
                        <CircleX className="h-3 w-3" /> GAGAL
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground max-w-[240px] truncate" title={entry.errorMessage ?? ""}>
                    {entry.errorMessage ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── PBG City Alert Subscriptions ──────────────────────────────────────────────

const SUPPORTED_CITIES = [
  "Jakarta", "Surabaya", "Bandung", "Medan", "Semarang",
  "Makassar", "Bekasi", "Depok", "Tangerang", "Bogor",
  "Palembang", "Batam", "Pekanbaru", "Denpasar", "Balikpapan",
  "Yogyakarta", "Malang", "Samarinda", "Banjarmasin", "Pontianak",
];

function PbgSubscriptionsPanel({ token }: { token: string }) {
  const qc = useQueryClient();

  const [waInput, setWaInput] = useState("");
  const [labelInput, setLabelInput] = useState("");
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [triggerReport, setTriggerReport] = useState<PbgAlertReport | null>(null);

  const fetcher = <T,>(path: string, init?: RequestInit) =>
    (fetch(`${API}/api${path}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...init?.headers,
      },
      ...init,
    }) as Promise<Response>).then(async (r) => {
      if (!r.ok) {
        const err = await r.json().catch(() => ({ error: r.statusText }));
        throw new Error((err as { error?: string }).error ?? r.statusText);
      }
      return r.json() as Promise<T>;
    });

  const { data: subs = [], isLoading } = useQuery<PbgSubscription[]>({
    queryKey: ["pbg-subscriptions", token],
    queryFn: () => fetcher("/pbg-subscriptions"),
    retry: false,
  });

  const addMutation = useMutation({
    mutationFn: (body: { whatsapp: string; label: string; cities: string[] }) =>
      fetcher<PbgSubscription>("/pbg-subscriptions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pbg-subscriptions", token] });
      setWaInput("");
      setLabelInput("");
      setSelectedCities([]);
    },
    onError: (err: unknown) => toast.error("Gagal menambah langganan PBG", { description: err instanceof Error ? err.message : "Coba lagi" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      fetcher<PbgSubscription>(`/pbg-subscriptions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pbg-subscriptions", token] }),
    onError: (err: unknown) => toast.error("Gagal mengubah status langganan PBG", { description: err instanceof Error ? err.message : "Coba lagi" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetcher(`/pbg-subscriptions/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pbg-subscriptions", token] }),
    onError: (err: unknown) => toast.error("Gagal menghapus langganan PBG", { description: err instanceof Error ? err.message : "Coba lagi" }),
  });
  const [confirmDeleteSubId, setConfirmDeleteSubId] = useState<number | null>(null);

  const triggerMutation = useMutation({
    mutationFn: () =>
      fetcher<PbgAlertReport>("/pbg-subscriptions/trigger-check", { method: "POST" }),
    onSuccess: (data) => setTriggerReport(data),
    onError: () => toast.error("Gagal memicu pengecekan PBG"),
  });

  const toggleCity = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city],
    );
  };

  const [waInputError, setWaInputError] = useState(false);
  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!waInput.trim()) { setWaInputError(true); return; }
    if (selectedCities.length === 0) return;
    setWaInputError(false);
    addMutation.mutate({
      whatsapp: waInput.trim(),
      label: labelInput.trim(),
      cities: selectedCities,
    });
  };

  return (
    <div className="rounded-sm border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Building className="h-4 w-4 text-primary" />
        <h2 className="font-mono text-sm font-bold flex-1">ALERT PBG BARU — Persetujuan Bangunan Gedung</h2>
        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {subs.length} subscriber
        </span>
      </div>

      <div className="p-4 space-y-5">
        {/* Description */}
        <div className="rounded-sm border border-blue-200 bg-blue-50/50 p-3">
          <p className="text-xs font-mono text-blue-800 leading-relaxed">
            <span className="font-bold">PBG (Persetujuan Bangunan Gedung)</span> dari OSS/SIMBG adalah sinyal paling awal bahwa proyek konstruksi akan dimulai — terbit sebelum kontraktor dipilih. Aktifkan alert WA per kota agar tim bisa mendekati pemrakarsa sebelum proses RFQ informal dimulai.
          </p>
        </div>

        {/* Add form */}
        <form onSubmit={handleAdd} className="space-y-3">
          <p className="text-xs font-mono font-semibold text-muted-foreground uppercase">Tambah Subscriber Baru</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex flex-col gap-1 flex-1 min-w-44">
              <label className="text-xs font-mono text-muted-foreground">NOMOR WA (INTL, contoh: 628123...)</label>
              <div className="relative">
                <MessageCircle className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={waInput}
                  onChange={(e) => { setWaInput(e.target.value); if (e.target.value.trim()) setWaInputError(false); }}
                  onBlur={() => { if (!waInput.trim()) setWaInputError(true); }}
                  placeholder="628123456789"
                  className={`h-9 w-full rounded-sm border bg-background pl-8 pr-3 text-sm font-mono focus:outline-none focus:ring-1 ${waInputError ? "border-red-500 focus:ring-red-500" : "border-input focus:border-primary focus:ring-primary"}`}
                  required
                />
              </div>
            </div>
            <div className="flex flex-col gap-1 flex-1 min-w-36">
              <label className="text-xs font-mono text-muted-foreground">LABEL (OPSIONAL)</label>
              <input
                type="text"
                value={labelInput}
                onChange={(e) => setLabelInput(e.target.value)}
                placeholder="misal: Tim BD Surabaya"
                className="h-9 w-full rounded-sm border border-input bg-background px-3 text-sm font-mono focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* City picker */}
          <div>
            <label className="text-xs font-mono text-muted-foreground block mb-1.5">
              KOTA YANG DIPANTAU <span className="text-destructive">*</span>
              {selectedCities.length > 0 && (
                <span className="ml-2 text-primary font-bold">{selectedCities.length} dipilih</span>
              )}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SUPPORTED_CITIES.map((city) => (
                <button
                  key={city}
                  type="button"
                  onClick={() => toggleCity(city)}
                  className={`text-[10px] font-mono px-2 py-1 rounded-sm border transition-colors ${
                    selectedCities.includes(city)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-input hover:border-primary hover:text-foreground"
                  }`}
                >
                  <MapPin className="inline h-2.5 w-2.5 mr-0.5" />
                  {city}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={addMutation.isPending || !waInput.trim() || selectedCities.length === 0}
            className="h-9 px-4 bg-primary text-primary-foreground font-mono text-sm rounded-sm hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            {addMutation.isPending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Tambah Subscriber
          </button>
          {addMutation.isError && (
            <p className="text-xs text-destructive font-mono">{(addMutation.error as Error)?.message}</p>
          )}
        </form>

        {/* Subscriber list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : subs.length === 0 ? (
          <div className="rounded-sm border border-dashed py-8 text-center">
            <Building className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">Belum ada subscriber alert PBG</p>
            <p className="text-xs text-muted-foreground mt-1">Tambahkan nomor WA dan pilih kota di atas</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-mono font-semibold text-muted-foreground uppercase">Daftar Subscriber</p>
            <ul className="divide-y rounded-sm border">
              {subs.map((sub) => (
                <li key={sub.id} className="group flex items-start gap-3 px-4 py-3">
                  <button
                    onClick={() => toggleMutation.mutate({ id: sub.id, enabled: !sub.enabled })}
                    className={`mt-0.5 flex-shrink-0 ${sub.enabled ? "text-primary" : "text-muted-foreground"}`}
                    title={sub.enabled ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {sub.enabled ? (
                      <ToggleRight className="h-5 w-5" />
                    ) : (
                      <ToggleLeft className="h-5 w-5" />
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-medium">{sub.whatsapp}</span>
                      {sub.label && (
                        <span className="text-xs text-muted-foreground">{sub.label}</span>
                      )}
                      <span className={`text-xs font-mono px-1.5 py-0.5 rounded-sm ${
                        sub.enabled ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                      }`}>
                        {sub.enabled ? "Aktif" : "Nonaktif"}
                      </span>
                    </div>
                    {sub.cities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {sub.cities.map((city) => (
                          <span key={city} className="text-[9px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-sm flex items-center gap-0.5">
                            <MapPin className="h-2 w-2" />
                            {city}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {confirmDeleteSubId === sub.id ? (
                    <span className="flex items-center gap-1 mt-0.5">
                      <button
                        autoFocus
                        onBlur={() => setConfirmDeleteSubId(null)}
                        onClick={() => { deleteMutation.mutate(sub.id); setConfirmDeleteSubId(null); }}
                        className="text-[10px] font-mono text-white bg-destructive hover:bg-destructive/90 rounded-sm px-1.5 py-0.5"
                      >✓</button>
                      <button onClick={() => setConfirmDeleteSubId(null)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">✕</button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteSubId(sub.id)}
                      disabled={deleteMutation.isPending}
                      className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 disabled:opacity-40"
                      title="Hapus penerima"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Manual trigger */}
        <div className="border-t pt-4">
          <p className="text-xs font-mono font-semibold text-muted-foreground uppercase mb-2">Cek Manual Sekarang</p>
          <p className="text-xs text-muted-foreground mb-3">
            Jalankan pengecekan PBG sekarang untuk semua subscriber aktif (menggunakan data 48 jam terakhir).
            Scheduler otomatis berjalan setiap hari pukul 07:00 WIB.
          </p>
          <button
            onClick={() => { setTriggerReport(null); triggerMutation.mutate(); }}
            disabled={triggerMutation.isPending || subs.filter((s) => s.enabled).length === 0}
            className="h-9 px-4 bg-secondary text-secondary-foreground font-mono text-sm rounded-sm border border-input hover:bg-secondary/80 disabled:opacity-50 flex items-center gap-2"
          >
            {triggerMutation.isPending ? (
              <><LoaderCircle className="h-4 w-4 animate-spin" /> Mengecek...</>
            ) : (
              <><Zap className="h-4 w-4" /> Cek PBG Sekarang</>
            )}
          </button>

          {subs.filter((s) => s.enabled).length === 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground font-mono">Aktifkan minimal satu subscriber untuk menjalankan cek.</p>
          )}

          {triggerReport && (
            <div className="mt-3 rounded-sm border p-3 bg-muted/30 space-y-1.5">
              <p className="font-mono text-xs font-bold">Hasil Cek PBG:</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Sinyal PBG Ditemukan", val: triggerReport.pbgItemsFound, color: triggerReport.pbgItemsFound > 0 ? "text-primary" : "text-muted-foreground" },
                  { label: "Subscriber Dicek", val: triggerReport.checkedSubscribers, color: "text-foreground" },
                  { label: "Alert Terkirim", val: triggerReport.alertsSent, color: triggerReport.alertsSent > 0 ? "text-green-700" : "text-muted-foreground" },
                  { label: "Alert Gagal", val: triggerReport.alertsFailed, color: triggerReport.alertsFailed > 0 ? "text-destructive" : "text-muted-foreground" },
                ].map((m) => (
                  <div key={m.label} className="flex items-center justify-between border rounded-sm p-2">
                    <span className="text-[10px] font-mono text-muted-foreground">{m.label}</span>
                    <span className={`text-sm font-bold font-mono ${m.color}`}>{m.val}</span>
                  </div>
                ))}
              </div>
              {triggerReport.pbgItemsFound === 0 && (
                <p className="text-xs text-muted-foreground font-mono">
                  Tidak ada sinyal PBG baru terdeteksi dalam 25 jam terakhir. Alert akan dikirim saat ada data PBG baru.
                </p>
              )}
              {triggerMutation.isError && (
                <p className="text-xs text-destructive font-mono">{triggerMutation.error?.message}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function RecipientSection({
  title,
  icon,
  settings,
  isLoading,
  onToggle,
  onDelete,
  emptyLabel,
}: {
  title: string;
  icon: React.ReactNode;
  settings: NotificationSetting[];
  isLoading: boolean;
  onToggle: (id: number, enabled: boolean) => void;
  onDelete: (id: number) => void;
  emptyLabel: string;
}) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  return (
    <div className="rounded-sm border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        {icon}
        <h2 className="font-mono text-sm font-bold">{title}</h2>
        <span className="ml-auto font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {settings.length} penerima
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <LoaderCircle className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : settings.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground font-mono flex flex-col items-center gap-2">
          <Plus className="h-6 w-6 opacity-30" />
          {emptyLabel}
        </div>
      ) : (
        <ul className="divide-y">
          {settings.map((s) => (
            <li key={s.id} className="group flex items-center gap-3 px-4 py-3 border-b last:border-b-0">
              <button
                onClick={() => onToggle(s.id, !s.enabled)}
                className={`flex-shrink-0 ${s.enabled ? "text-primary" : "text-muted-foreground"}`}
                title={s.enabled ? "Nonaktifkan" : "Aktifkan"}
              >
                {s.enabled ? (
                  <ToggleRight className="h-5 w-5" />
                ) : (
                  <ToggleLeft className="h-5 w-5" />
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-mono truncate" title={s.recipient}>{s.recipient}</p>
                {s.label && (
                  <p className="text-xs text-muted-foreground" title={s.label}>{s.label}</p>
                )}
              </div>

              <span
                className={`text-xs font-mono px-2 py-0.5 rounded ${
                  s.enabled
                    ? "bg-green-100 text-green-700"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.enabled ? "Aktif" : "Nonaktif"}
              </span>

              {confirmDeleteId === s.id ? (
                <span className="flex items-center gap-1">
                  <button
                    autoFocus
                    onBlur={() => setConfirmDeleteId(null)}
                    onClick={() => { onDelete(s.id); setConfirmDeleteId(null); }}
                    className="text-[10px] font-mono text-white bg-destructive hover:bg-destructive/90 rounded-sm px-1.5 py-0.5"
                  >✓</button>
                  <button onClick={() => setConfirmDeleteId(null)} className="text-[10px] font-mono text-muted-foreground hover:text-foreground">✕</button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDeleteId(s.id)}
                  className="text-muted-foreground hover:text-destructive transition-all opacity-0 group-hover:opacity-100"
                  title="Hapus"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
