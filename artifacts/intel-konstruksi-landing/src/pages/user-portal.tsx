import React, { useEffect, useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { Radar, LogOut, Loader2, Lock, FileText, Activity, AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { motion } from "framer-motion";

interface UserRecord {
  id: number;
  clerkId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  company: string | null;
  adminNote: string | null;
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const API_BASE = BASE_URL.replace(/\/intel-konstruksi/, "");

function statusBadge(status: string) {
  if (status === "APPROVED") return { label: "Akses Disetujui", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: CheckCircle };
  if (status === "REJECTED") return { label: "Akses Ditolak", color: "text-red-400", bg: "bg-red-500/10 border-red-500/30", icon: XCircle };
  return { label: "Sedang Ditinjau", color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/30", icon: Clock };
}

export default function UserPortalPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [dbUser, setDbUser] = useState<UserRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(true);
  const [errorRecord, setErrorRecord] = useState(false);

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch(`${API_BASE}/api/me`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<UserRecord>;
      })
      .then((data) => setDbUser(data))
      .catch(() => setErrorRecord(true))
      .finally(() => setLoadingRecord(false));
  }, [isLoaded, user]);

  if (!isLoaded || loadingRecord) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const displayName = dbUser?.firstName
    ? `${dbUser.firstName}${dbUser.lastName ? ` ${dbUser.lastName}` : ""}`
    : user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? "Pengguna";

  const st = dbUser ? statusBadge(dbUser.status) : statusBadge("PENDING");
  const StatusIcon = st.icon;
  const isApproved = dbUser?.status === "APPROVED";
  const isRejected = dbUser?.status === "REJECTED";

  const memberSince = dbUser?.createdAt
    ? new Date(dbUser.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Navbar */}
      <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Radar className="w-5 h-5 text-primary" />
          <span className="font-bold text-sm tracking-tight uppercase">Intel<span className="text-primary">Konstruksi</span></span>
          <span className={`ml-4 px-2 py-0.5 rounded text-[10px] font-mono border hidden sm:inline-flex items-center gap-1 ${st.bg} ${st.color}`}>
            <StatusIcon className="w-2.5 h-2.5" />
            {st.label.toUpperCase()}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground hidden sm:block">
            {dbUser?.email || user?.primaryEmailAddress?.emailAddress}
          </div>
          <button
            onClick={() => signOut({ redirectUrl: basePath || "/" })}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-sm transition-colors"
            title="Keluar"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 flex flex-col justify-center gap-4">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-lg p-8 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-transparent" />

          <div className="flex items-center gap-4 mb-6">
            {dbUser?.imageUrl ? (
              <img src={dbUser.imageUrl} alt={displayName} className="w-16 h-16 rounded-full object-cover border border-border" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center border border-border">
                <Lock className="w-8 h-8 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{displayName}</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">
                ID: {dbUser?.clerkId?.split("_")[1]?.substring(0, 8).toUpperCase() ?? "–"}
                {memberSince ? ` · Bergabung ${memberSince}` : ""}
              </p>
              {dbUser?.company && (
                <p className="text-xs text-muted-foreground mt-0.5">{dbUser.company}</p>
              )}
            </div>
          </div>

          {/* Status panel */}
          {isApproved ? (
            <div className="p-4 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex gap-3 mb-6">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm">Akses Diberikan</h3>
                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                  Akun Anda telah diverifikasi. Anda memiliki akses penuh ke platform Intel Konstruksi.
                  {dbUser?.adminNote && <><br /><span className="italic opacity-70">{dbUser.adminNote}</span></>}
                </p>
              </div>
            </div>
          ) : isRejected ? (
            <div className="p-4 rounded border border-red-500/30 bg-red-500/10 text-red-400 flex gap-3 mb-6">
              <XCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm">Akses Ditolak</h3>
                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                  Permintaan akses Anda tidak dapat disetujui saat ini.
                  {dbUser?.adminNote && <><br /><span className="italic">{dbUser.adminNote}</span></>}
                  {" "}Hubungi{" "}
                  <a href="mailto:info@intel-konstruksi.id" className="underline">info@intel-konstruksi.id</a>
                  {" "}untuk informasi lebih lanjut.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded border border-yellow-500/20 bg-yellow-500/10 text-yellow-500 flex gap-3 mb-6">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm">Akun Sedang Ditinjau</h3>
                <p className="text-xs opacity-80 mt-1 leading-relaxed">
                  Permintaan akses Anda ke terminal Intel Konstruksi telah diterima. Tim kami sedang memverifikasi identitas perusahaan Anda. Akses data penuh akan diberikan segera.
                </p>
              </div>
            </div>
          )}

          {/* Feature grid */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className={`p-4 rounded border transition-opacity ${isApproved ? "border-border bg-secondary/30" : "border-border bg-secondary/30 opacity-50 cursor-not-allowed"}`}>
              <Activity className="w-5 h-5 mb-2" />
              <h4 className="font-bold text-sm">Feed Tender Langsung</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {isApproved ? "Akses penuh tersedia" : "Terkunci — menunggu verifikasi"}
              </p>
            </div>
            <div className={`p-4 rounded border transition-opacity ${isApproved ? "border-border bg-secondary/30" : "border-border bg-secondary/30 opacity-50 cursor-not-allowed"}`}>
              <FileText className="w-5 h-5 mb-2" />
              <h4 className="font-bold text-sm">Database Kontraktor</h4>
              <p className="text-xs text-muted-foreground mt-1">
                {isApproved ? "Akses penuh tersedia" : "Terkunci — menunggu verifikasi"}
              </p>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-border flex justify-between items-center text-xs font-mono text-muted-foreground">
            <span>STATUS_SISTEM: NORMAL</span>
            <span>IP_TERCATAT · {new Date().toLocaleDateString("id-ID")}</span>
          </div>
        </motion.div>

        {/* Error fallback */}
        {errorRecord && (
          <p className="text-xs text-center text-muted-foreground font-mono">
            Tidak dapat memuat data profil dari server — coba muat ulang halaman.
          </p>
        )}
      </main>
    </div>
  );
}
