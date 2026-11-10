import React, { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowRight, Bot, Brain, Building2, ChartBar, CircleCheck,
  Clock, Database, FileText, Globe, HardHat, Layers,
  Lightbulb, Shield, Sparkles, Target, TrendingUp, Zap,
  TriangleAlert, DollarSign, Users, RefreshCw, ChevronDown,
} from "lucide-react";

// ─── Animated Counter ─────────────────────────────────────────────────────────
function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const ran = useRef(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !ran.current) {
        ran.current = true;
        const start = performance.now();
        const duration = 1800;
        function step(now: number) {
          const p = Math.min((now - start) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 4);
          setVal(Math.round(ease * to));
          if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
      }
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [to]);

  return <span ref={ref}>{prefix}{val.toLocaleString("id-ID")}{suffix}</span>;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const PAINS = [
  { icon: TriangleAlert, text: "Kehilangan tender karena SBU kadaluarsa saat deadline pengajuan", color: "text-red-500" },
  { icon: TriangleAlert, text: "Tim SKK tidak tahu siapa yang perlu perpanjangan hingga sudah terlambat", color: "text-red-500" },
  { icon: TriangleAlert, text: "Riset kompetitor dilakukan manual — makan waktu 2–3 hari, hasilnya sudah basi", color: "text-orange-500" },
  { icon: TriangleAlert, text: "Peluang tender BUMN terlewat karena tidak ada monitoring otomatis", color: "text-orange-500" },
  { icon: TriangleAlert, text: "Tidak ada data valid untuk mendukung keputusan strategi marketing", color: "text-yellow-600" },
];

const FEATURES = [
  {
    icon: Database, title: "64+ Sumber Data Otomatis",
    desc: "LPSE, LPJK, BNSP, PUPR, BUMN, media konstruksi — semua dikumpulkan jam 07:00 WIB setiap hari tanpa kerja manual.",
    accent: "from-blue-600/20 to-blue-600/5",
    badge: "Otomatis",
  },
  {
    icon: Shield, title: "Monitor SBU & SKK Real-time",
    desc: "Tahu persis kapan sertifikat kontraktor atau tenaga ahli habis. Alert sebelum kadaluarsa, bukan setelah rugi.",
    accent: "from-violet-600/20 to-violet-600/5",
    badge: "Alert",
  },
  {
    icon: TrendingUp, title: "Radar Tender Nasional",
    desc: "Semua tender konstruksi dari SPSE/LPSE nasional — nilai HPS, batas waktu, profil risiko — dalam satu layar.",
    accent: "from-green-600/20 to-green-600/5",
    badge: "Live",
  },
  {
    icon: Brain, title: "Laporan Intelijen 1-Klik",
    desc: "Gabungan regulasi terbaru + kompetitor + sinyal pasar dikompilasi otomatis jadi brief siap presentasi.",
    accent: "from-amber-600/20 to-amber-600/5",
    badge: "AI-powered",
  },
  {
    icon: Bot, title: "Multi-AI Chat Assistant",
    desc: "ChatGPT, DeepSeek, Gemini, Qwen — pilih model terbaik untuk analisis data riset dan panduan platform.",
    accent: "from-rose-600/20 to-rose-600/5",
    badge: "4 Model AI",
  },
  {
    icon: Lightbulb, title: "Peluang Bisnis Otomatis",
    desc: "Platform silangkan data pain points dengan katalog layanan, hasilkan prospek otomatis setiap hari.",
    accent: "from-cyan-600/20 to-cyan-600/5",
    badge: "Insight",
  },
];

const STATS = [
  { to: 64, suffix: "+", label: "Sumber Data Aktif", icon: Globe },
  { to: 9, suffix: "", label: "AI Agents Spesialisasi", icon: Bot },
  { to: 100, suffix: "%", label: "Otomatis, tanpa manual input", icon: Zap },
  { to: 7, suffix: ":00 WIB", label: "Brief harian dikirim otomatis", icon: Clock },
];

const TESTIMONIALS = [
  {
    quote: "Sebelumnya kami kehilangan tender karena SBU kadaluarsa. Sekarang ada alert 30 hari sebelumnya.",
    name: "Manajer Operasional BUJK", company: "Jakarta",
    initial: "MO",
  },
  {
    quote: "Riset kompetitor yang dulu 3 hari kerja, sekarang bisa saya baca dalam 5 menit dari Laporan Intelijen.",
    name: "Direktur Marketing", company: "Surabaya",
    initial: "DM",
  },
  {
    quote: "Data SKK tim kami tersebar di Excel yang beda-beda. Sekarang semua terpusat dan bisa dicari real-time.",
    name: "HRD Konstruksi", company: "Bandung",
    initial: "HR",
  },
];

const HOW_STEPS = [
  {
    num: "01", title: "Platform kumpulkan data",
    desc: "Setiap pukul 07:00 WIB, 9 AI agents menyusuri 64+ sumber — LPSE, LPJK, BNSP, media, dan lebih banyak lagi.",
    icon: RefreshCw,
  },
  {
    num: "02", title: "Data diolah jadi insight",
    desc: "Data mentah diubah jadi laporan, peringatan, dan peluang bisnis yang langsung bisa dieksekusi.",
    icon: Brain,
  },
  {
    num: "03", title: "Tim terima brief di pagi hari",
    desc: "Briefing PDF dan ringkasan WhatsApp otomatis terkirim ke tim sebelum jam kerja dimulai.",
    icon: FileText,
  },
  {
    num: "04", title: "Keputusan lebih cepat & akurat",
    desc: "Tidak ada lagi rapat tanpa data. Setiap strategi marketing didukung riset pasar yang selalu terkini.",
    icon: Target,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function Landing() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const FAQS = [
    {
      q: "Apakah platform ini cocok untuk perusahaan saya?",
      a: "Ya, jika perusahaan Anda bergerak di jasa konstruksi, konsultan SBU/SKK, atau marketing layanan konstruksi. Platform dirancang untuk PT. Maheswara Jaya Persada dan dapat diadaptasi.",
    },
    {
      q: "Apakah data diperbarui setiap hari?",
      a: "Ya. Sistem berjalan otomatis jam 07:00 WIB setiap hari — mengumpulkan data dari 64+ sumber tanpa intervensi manual.",
    },
    {
      q: "Model AI apa yang tersedia?",
      a: "Tersedia 4 model: ChatGPT (OpenAI GPT-4o), DeepSeek V3, Google Gemini Flash, dan Qwen 3.6 — bisa dipilih sesuai kebutuhan analisis.",
    },
    {
      q: "Apakah bisa export data?",
      a: "Ya. Tersedia export PDF (briefing, MKR eksekutif, laporan intelijen) dan Excel (tender, riset, daftar sumber error) dengan filter sebelum export.",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="font-black text-sm tracking-tight">INTEL-KONSTRUKSI</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">PT. Maheswara Jaya Persada</span>
            <Link href="/" className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 rounded-full hover:bg-primary/90 transition-colors">
              Masuk Platform <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO (Attention) ── */}
      <section className="pt-32 pb-20 px-6 max-w-6xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary border border-primary/20 rounded-full px-4 py-1.5 text-xs font-bold mb-8">
          <Sparkles className="h-3.5 w-3.5" />
          Platform Intelijen Pasar #1 untuk Konstruksi Indonesia
        </div>
        <h1 className="text-4xl sm:text-6xl font-black leading-tight tracking-tight mb-6">
          Riset 64 Sumber Data<br />
          <span className="text-primary">Otomatis</span> Setiap Pagi.
        </h1>
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Tidak ada lagi kehilangan tender karena SBU kadaluarsa. Tidak ada lagi riset manual yang makan 3 hari.
          INTEL-KONSTRUKSI mengumpulkan, mengolah, dan mengirimkan brief intelijen pasar konstruksi otomatis setiap hari.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/" className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-8 py-4 rounded-xl hover:bg-primary/90 transition-all hover:scale-105 text-sm shadow-lg shadow-primary/25">
            Masuk ke Platform <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="#fitur"
            className="inline-flex items-center gap-2 border font-semibold px-8 py-4 rounded-xl hover:bg-muted transition-colors text-sm"
          >
            Lihat Fitur <ChevronDown className="h-4 w-4" />
          </a>
        </div>

        {/* Social proof strip */}
        <div className="mt-14 flex flex-wrap gap-6 justify-center">
          {[
            { icon: CircleCheck, text: "Tanpa input manual" },
            { icon: CircleCheck, text: "Data diperbarui setiap pagi" },
            { icon: CircleCheck, text: "4 Model AI terintegrasi" },
            { icon: CircleCheck, text: "Export PDF & Excel" },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Icon className="h-4 w-4 text-primary" />
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-muted/50 border-y py-14 px-6">
        <div className="max-w-5xl mx-auto grid grid-cols-2 sm:grid-cols-4 gap-8 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <s.icon className="h-6 w-6 mx-auto text-primary mb-2" />
              <p className="text-3xl sm:text-4xl font-black text-primary">
                <Counter to={s.to} suffix={s.suffix} />
              </p>
              <p className="text-xs text-muted-foreground mt-1 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEM (Problem/Agitate) ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <Badge variant="problem" />
          <h2 className="text-3xl sm:text-4xl font-black mt-4 mb-4">
            Masalah yang Pasti Pernah Kamu Alami
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Tim marketing konstruksi kehilangan peluang bernilai miliaran karena satu hal: <strong>tidak ada data real-time</strong>.
          </p>
        </div>
        <div className="space-y-3 max-w-2xl mx-auto">
          {PAINS.map((p, i) => (
            <div key={i} className="flex items-start gap-3 p-4 rounded-xl border bg-background hover:border-destructive/30 transition-colors">
              <p.icon className={cn("h-5 w-5 shrink-0 mt-0.5", p.color)} />
              <p className="text-sm leading-relaxed">{p.text}</p>
            </div>
          ))}
        </div>
        <p className="text-center mt-8 text-sm text-muted-foreground">
          Kalau salah satu terasa familiar — <strong className="text-foreground">INTEL-KONSTRUKSI dibuat untuk ini.</strong>
        </p>
      </section>

      {/* ── FEATURES (Interest/Desire) ── */}
      <section id="fitur" className="py-20 px-6 bg-muted/30 border-y">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black mb-4">
              Semua yang Dibutuhkan Tim Marketing Konstruksi
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Satu platform — dari pengumpulan data hingga brief siap presentasi ke klien dan investor.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="rounded-2xl border bg-background p-6 hover:border-primary/30 hover:shadow-lg transition-all group"
              >
                <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${f.accent} mb-4`}>
                  <f.icon className="h-5 w-5 text-foreground" />
                </div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-bold text-sm leading-tight">{f.title}</h3>
                  <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">
                    {f.badge}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">Bagaimana Platform Bekerja</h2>
          <p className="text-muted-foreground">Set sekali, berjalan otomatis setiap hari.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {HOW_STEPS.map((s, i) => (
            <div key={s.num} className="relative">
              {i < HOW_STEPS.length - 1 && (
                <div className="hidden lg:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-primary/40 to-transparent z-0" />
              )}
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-8 w-8 rounded-xl bg-primary flex items-center justify-center shrink-0">
                    <s.icon className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-2xl font-black text-muted-foreground/30">{s.num}</span>
                </div>
                <h3 className="font-bold text-sm mb-2">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="py-20 px-6 bg-primary text-primary-foreground">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-black text-center mb-12">
            Apa Kata Pengguna
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="bg-primary-foreground/10 rounded-2xl p-6 border border-primary-foreground/20">
                <p className="text-sm leading-relaxed mb-6 text-primary-foreground/90">
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-xs font-black">
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-xs font-bold">{t.name}</p>
                    <p className="text-[10px] text-primary-foreground/60">{t.company}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── AI MODELS ── */}
      <section className="py-20 px-6 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-black mb-4">4 Model AI, 1 Platform</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Pilih AI terbaik untuk setiap analisis. Ganti model kapan saja tanpa kehilangan konteks.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { name: "ChatGPT", model: "GPT-4o", provider: "OpenAI", color: "bg-emerald-500", desc: "Paling pintar, kontext panjang, ideal untuk analisis mendalam" },
            { name: "DeepSeek", model: "V3", provider: "DeepSeek AI", color: "bg-blue-500", desc: "Reasoning kuat, cepat, unggul untuk analisis data terstruktur" },
            { name: "Gemini", model: "Flash", provider: "Google", color: "bg-violet-500", desc: "Multimodal, respons sangat cepat, cocok untuk query singkat" },
            { name: "Qwen", model: "3.6", provider: "Alibaba", color: "bg-orange-500", desc: "Unggul di bahasa Asia, pemahaman konteks Indonesia sangat baik" },
          ].map(m => (
            <div key={m.name} className="border rounded-2xl p-5 hover:border-primary/30 hover:shadow-md transition-all text-center">
              <div className={`h-10 w-10 rounded-2xl ${m.color} mx-auto mb-3 flex items-center justify-center`}>
                <Bot className="h-5 w-5 text-white" />
              </div>
              <p className="font-black text-sm">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.provider} · {m.model}</p>
              <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA (Action) ── */}
      <section className="py-24 px-6 border-t">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-5xl font-black mb-6 leading-tight">
            Mulai Gunakan<br />
            <span className="text-primary">INTEL-KONSTRUKSI</span> Sekarang
          </h2>
          <p className="text-muted-foreground mb-10 text-lg max-w-xl mx-auto">
            Bergabung dengan tim yang sudah berhenti membuang waktu untuk riset manual dan mulai buat keputusan berbasis data.
          </p>
          <Link href="/" className="inline-flex items-center gap-3 bg-primary text-primary-foreground font-black px-10 py-5 rounded-2xl hover:bg-primary/90 transition-all hover:scale-105 text-base shadow-2xl shadow-primary/30">
            <Zap className="h-5 w-5" />
            Masuk ke Platform
            <ArrowRight className="h-5 w-5" />
          </Link>
          <p className="mt-6 text-xs text-muted-foreground">
            Untuk tim internal PT. Maheswara Jaya Persada
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 px-6 border-t bg-muted/30 max-w-3xl mx-auto">
        <h2 className="text-2xl font-black text-center mb-8">Pertanyaan Umum</h2>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="border rounded-xl bg-background overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-left hover:bg-muted/50 transition-colors"
              >
                {f.q}
                <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed border-t pt-3">
                  {f.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-6 w-6 rounded-lg bg-primary flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="font-black text-sm">INTEL-KONSTRUKSI</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Platform Riset Marketing Konstruksi Indonesia<br />
          © 2026 PT. Maheswara Jaya Persada. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// cn helper (inline to avoid import issues)
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Badge component for problem section
function Badge({ variant }: { variant: string }) {
  if (variant === "problem") {
    return (
      <div className="inline-flex items-center gap-2 bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-4 py-1.5 text-xs font-bold">
        <TriangleAlert className="h-3.5 w-3.5" />
        Masalah Nyata di Lapangan
      </div>
    );
  }
  return null;
}
