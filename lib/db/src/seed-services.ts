/**
 * Seed: service catalog (output_products JASA/LAPORAN) + AI recommendations
 * Run: /home/runner/workspace/scripts/node_modules/.bin/tsx lib/db/src/seed-services.ts
 */
import { db, outputProductsTable, aiRecommendationsTable } from "./index";
import { inArray, eq } from "drizzle-orm";

// ── 1. Service catalog (output_products) ─────────────────────────────────────
const services = [
  {
    type: "JASA",
    title: "Dokumen Penerapan SMAP (SNI ISO 37001:2016)",
    description:
      "Penyusunan SOP, prosedur, dan form penerapan Sistem Manajemen Anti Penyuapan sesuai SNI ISO 37001:2016 untuk pemenuhan persyaratan SBU. Harga Rp 2.500.000 — selesai 4 hari kerja setelah pembayaran.",
    targetSegment: "KONTRAKTOR",
    keyMessages:
      "Wajib bagi semua BUJK — LPJK menerbitkan daftar ketidaksesuaian SMAP. Sanksi administratif bagi yang belum penuhi.",
    format: "Dokumen fisik + digital (PDF)",
    platform: "Offline/Online",
    status: "ACTIVE",
  },
  {
    type: "JASA",
    title: "Sertifikat ISO 37001:2016 (Non-KAN)",
    description:
      "Pendampingan pengurusan sertifikat ISO 37001:2016 Anti-Penyuapan tanpa akreditasi KAN — lebih cepat dan terjangkau untuk pemenuhan syarat SBU. Harga Rp 15.000.000 per sertifikat.",
    targetSegment: "KONTRAKTOR",
    keyMessages:
      "Selesai 7 hari kerja setelah dokumen lengkap dan pembayaran dikonfirmasi. Alternatif sah yang diterima LPJK.",
    format: "Sertifikat resmi",
    platform: "Offline",
    status: "ACTIVE",
  },
  {
    type: "JASA",
    title: "Sewa Alat Konstruksi untuk Pemenuhan SBU (3 Tahun)",
    description:
      "Penyediaan alat konstruksi sesuai persyaratan SBU LPJK. Kualifikasi Kecil Rp 5 jt | Menengah/Spesialis Rp 7,5 jt | Besar BUJKN/PMA Rp 10 jt | Kantor Perwakilan BUJKA Rp 12 jt. Masa sewa 3 tahun.",
    targetSegment: "KONTRAKTOR",
    keyMessages:
      "Solusi cepat pemenuhan aset alat tanpa harus beli — proses 3 hari kerja. Sesuai masa berlaku SBU.",
    format: "Dokumen sewa + bukti kepemilikan alat",
    platform: "Offline",
    status: "ACTIVE",
  },
  {
    type: "JASA",
    title: "Sewa SKK Tenaga Ahli untuk Pemenuhan SBU (3 Tahun)",
    description:
      "Penyediaan tenaga ahli bersertifikat SKK untuk pemenuhan persyaratan SDM pada SBU. Jenjang 7: Rp 10 jt | Jenjang 8: Rp 12 jt | Jenjang 9: Rp 15 jt. Proses 10 hari kerja.",
    targetSegment: "KONTRAKTOR",
    keyMessages:
      "Solusi saat perusahaan tidak punya tenaga ahli bersertifikat — masa penugasan 3 tahun sesuai SBU.",
    format: "Surat penugasan + dokumen SKK asli",
    platform: "Offline",
    status: "ACTIVE",
  },
  {
    type: "JASA",
    title: "Pengurusan Sertifikat Standar BUJKN/PMA (per KBLI)",
    description:
      "Pendampingan pengurusan Sertifikat Standar via OSS-RBA untuk BUJK nasional dan PMA. Harga Rp 1.500.000 per KBLI, selesai 3 hari kerja. Termasuk pengurusan OSS dan MBKI.",
    targetSegment: "KONTRAKTOR",
    keyMessages:
      "Proses tercepat di pasaran. Sudah berpengalaman ratusan BUJK. Paket multi-KBLI tersedia dengan harga khusus.",
    format: "Sertifikat Standar digital via OSS",
    platform: "Online",
    status: "ACTIVE",
  },
  {
    type: "JASA",
    title: "Konsultasi Perpanjangan SBU Kontraktor/Konsultan",
    description:
      "Layanan konsultasi dan pendampingan perpanjangan SBU sebelum masa berlaku habis — cek persyaratan, kelengkapan dokumen, koordinasi MBKI/LPJK, hingga SBU baru terbit.",
    targetSegment: "KONTRAKTOR",
    keyMessages:
      "SBU kadaluarsa = diskualifikasi tender. Hubungi kami minimal 3 bulan sebelum expire untuk proses mulus.",
    format: "Konsultasi + pendampingan dokumen",
    platform: "Online/Offline",
    status: "ACTIVE",
  },
  {
    type: "JASA",
    title: "Pendampingan Perpanjangan SKK Tenaga Konstruksi",
    description:
      "Layanan pendampingan perpanjangan SKK jenjang 7/8/9 — cek kelayakan, persiapan dokumen, koordinasi LSP, hingga SKK baru terbit. SKK berlaku 5 tahun.",
    targetSegment: "TENAGA_KERJA",
    keyMessages:
      "Jangan sampai SKK kadaluarsa — kehilangan pekerjaan dan harus ulang uji kompetensi. Kami reminder + bantu proses.",
    format: "Dokumen permohonan + SKK baru",
    platform: "Online/Offline",
    status: "ACTIVE",
  },
  {
    type: "LAPORAN",
    title: "Laporan Monitoring SBU/SKK Kadaluarsa Per Wilayah (Bulanan)",
    description:
      "Laporan bulanan berisi daftar kontraktor dan konsultan di wilayah target yang SBU atau SKK tenaga ahlinya akan kadaluarsa dalam 90 hari — dilengkapi info kontak, nilai aset, dan subklasifikasi.",
    targetSegment: "SEMUA",
    keyMessages:
      "Data prospek penjualan layanan perpanjangan SBU/SKK yang siap pakai untuk tim penjualan. Diperbarui setiap bulan.",
    format: "PDF + Excel",
    platform: "Digital",
    status: "ACTIVE",
  },
];

// ── 2. AI recommendations ─────────────────────────────────────────────────────
const aiRecs = [
  {
    aiProductName: "DokumenClaw",
    description:
      "AI generator dokumen proyek konstruksi — RAB, RKS, spesifikasi teknis, laporan harian, dan berita acara dalam hitungan menit. Berbasis database template dari dokumenproyek.com.",
    problemSolved:
      "Pembuatan dokumen proyek manual memakan waktu berhari-hari, rawan error, dan tidak terstandar. Kontraktor dan konsultan butuh template yang selalu up-to-date sesuai regulasi SNI/PUPR.",
    targetUsers: "Kontraktor, Konsultan, Project Manager",
    techStack:
      "LLM (GPT-4o) + RAG dari database template dokumenproyek.com + jsPDF/docx generator + SNI database",
    feasibility: "HIGH",
    priority: "HIGH",
    revenueModel:
      "Subscription Rp 150.000/bulan per pengguna + pay-per-doc untuk dokumen premium (DED, RKS kompleks)",
    estimatedImpact:
      "Menghemat 80% waktu penyusunan dokumen. TAM: 400.000+ kontraktor aktif Indonesia. dokumenproyek.com: 100.000+ template didownload.",
    status: "CONCEPT",
  },
  {
    aiProductName: "SBUAdvisorClaw",
    description:
      "AI konsultan SBU interaktif — menjawab pertanyaan seputar pengurusan, perpanjangan, dan naik kualifikasi SBU berdasarkan artikel gustafta.my.id dan regulasi PUPR/LPJK terkini.",
    problemSolved:
      "Kontraktor kecil/menengah tidak tahu harus mulai dari mana untuk urus SBU. Konsultan mahal, info internet tersebar dan sering outdated. gustafta.my.id sudah menjadi referensi utama tapi statis.",
    targetUsers: "Direktur BUJK, Admin perusahaan konstruksi, Kontraktor pemula",
    techStack:
      "RAG dari gustafta.my.id + regulasi LPJK/PUPR/OSS + LLM streaming chat + update otomatis saat regulasi berubah",
    feasibility: "HIGH",
    priority: "CRITICAL",
    revenueModel:
      "Freemium: 10 tanya/bulan gratis, unlimited Rp 99.000/bulan + lead generation ke layanan jasa SBU",
    estimatedImpact:
      "Konversi trafik organik SBU/SKK ke leads layanan. gustafta.my.id mendapat 50.000+ visitor/bulan dari Google search 'cara urus SBU'.",
    status: "CONCEPT",
  },
  {
    aiProductName: "ExpiryTrackerClaw",
    description:
      "AI monitoring otomatis masa berlaku SBU dan SKK — deteksi kadaluarsa dari LPJK/OSS, kirim notifikasi ke perusahaan, dan konversi ke leads layanan perpanjangan.",
    problemSolved:
      "Kontraktor lupa perpanjang SBU/SKK → diskualifikasi tender + sanksi LPJK. Tidak ada sistem reminder dari LPJK. Tim marketing tidak tahu siapa yang perlu perpanjang.",
    targetUsers: "Tim Marketing BUJK Konsultan, Admin perusahaan konstruksi besar",
    techStack:
      "Scraper LPJK/OSS + PostgreSQL scheduler + WhatsApp Business API + email + CRM integration",
    feasibility: "HIGH",
    priority: "CRITICAL",
    revenueModel:
      "B2B SaaS Rp 500.000/bulan per perusahaan + komisi 5% dari layanan perpanjangan yang berhasil dikonversi",
    estimatedImpact:
      "Pipeline prospek berkelanjutan — setiap SBU/SKK yang expire adalah peluang penjualan. Estimasi 10.000+ SBU kadaluarsa per bulan.",
    status: "DEVELOPMENT",
  },
  {
    aiProductName: "ProposalClaw",
    description:
      "AI generator surat penawaran layanan jasa konstruksi — input nama klien + layanan yang dipilih → surat penawaran profesional siap kirim dalam format PDF/Word dalam 5 menit.",
    problemSolved:
      "Tim penjualan membuang 2–3 jam per surat penawaran yang isinya 80% sama. Proposal tidak konsisten brand dan tidak personalized untuk setiap klien.",
    targetUsers: "Tim Marketing, Sales, Direktur BUJK",
    techStack: "Template engine + LLM personalization + jsPDF export + integrasi CRM & data klien",
    feasibility: "HIGH",
    priority: "HIGH",
    revenueModel:
      "Built-in di platform Intel-Konstruksi sebagai fitur premium subscription — nilai tambah paket bisnis",
    estimatedImpact:
      "Kurangi waktu buat proposal dari 2 jam ke 5 menit. Konsistensi brand meningkat 100%.",
    status: "ACTIVE",
  },
];

async function seed() {
  console.log("Seeding service catalog and AI recommendations...");

  // Delete old JASA/LAPORAN output products
  await db
    .delete(outputProductsTable)
    .where(inArray(outputProductsTable.type, ["JASA", "LAPORAN"]));

  for (const s of services) {
    await db.insert(outputProductsTable).values(s);
  }
  console.log(`✅ Seeded ${services.length} service catalog items (output_products)`);

  // Upsert AI recommendations
  for (const r of aiRecs) {
    const existing = await db
      .select()
      .from(aiRecommendationsTable)
      .where(eq(aiRecommendationsTable.aiProductName, r.aiProductName));

    if (existing.length > 0) {
      await db
        .update(aiRecommendationsTable)
        .set(r)
        .where(eq(aiRecommendationsTable.aiProductName, r.aiProductName));
    } else {
      await db.insert(aiRecommendationsTable).values({ ...r, status: r.status ?? "CONCEPT" });
    }
  }
  console.log(`✅ Seeded/updated ${aiRecs.length} AI recommendations`);

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
