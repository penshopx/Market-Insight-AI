import { useState, useEffect } from "react";
import { Zap, Lock, Eye, EyeOff, LoaderCircle } from "lucide-react";

interface LoginPageProps {
  onLogin: (password: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);
    setError("");
    const result = await onLogin(password);
    if (!result.ok) {
      setError(result.error ?? "Login gagal");
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-background flex items-center justify-center p-4"
      style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.3s" }}
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25 mx-auto">
            <Zap className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">INTEL-KONSTRUKSI</h1>
          <p className="text-sm text-muted-foreground">
            Platform Riset Marketing Konstruksi
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border bg-card shadow-sm p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Masuk ke Platform</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password…"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-3 pr-10 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  autoFocus
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShow((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 font-mono">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full h-10 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <><LoaderCircle className="h-4 w-4 animate-spin" /> Memeriksa...</>
              ) : (
                <><Lock className="h-4 w-4" /> Masuk</>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          PT. Maheswara Jaya Persada &mdash; Akses Tim Internal
        </p>
      </div>
    </div>
  );
}
