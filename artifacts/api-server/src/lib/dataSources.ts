export interface DataSourceConfig {
  id: string;
  name: string;
  url: string;
  category: string;
  description: string;
}

export const DATA_SOURCES: DataSourceConfig[] = [

  // ══════════════════════════════════════════════════════════════════════════
  // TENDER & PENGADAAN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "spse-inaproc",
    name: "SPSE / LPSE Nasional (LKPP)",
    url: "https://spse.inaproc.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Portal pengadaan pemerintah nasional — data paket tender konstruksi seluruh Indonesia dari LKPP",
  },
  {
    id: "indotender",
    name: "IndoTender",
    url: "https://www.indotender.com/",
    category: "TENDER_OPPORTUNITY",
    description: "Agregator tender konstruksi dari berbagai instansi pemerintah dan swasta",
  },
  {
    id: "pengadaan-co-id",
    name: "Pengadaan.co.id",
    url: "https://www.pengadaan.co.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Platform informasi pengadaan barang dan jasa konstruksi pemerintah",
  },
  {
    id: "tender-indonesia",
    name: "Tender Indonesia",
    url: "https://www.tender-indonesia.com/",
    category: "TENDER_OPPORTUNITY",
    description: "Kumpulan pengumuman tender konstruksi dari seluruh wilayah Indonesia",
  },
  {
    id: "lpse-kemenpupr",
    name: "LPSE Kementerian PUPR",
    url: "https://lpse.pu.go.id/eproc4/",
    category: "TENDER_OPPORTUNITY",
    description: "LPSE resmi Kementerian PUPR — paket lelang infrastruktur jalan, jembatan, bendungan, gedung pemerintah",
  },
  {
    id: "lpse-kemen-bumn",
    name: "LPSE Kementerian BUMN / Anak Perusahaan",
    url: "https://pengadaan.bumn.go.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Portal pengadaan BUMN — tender konstruksi dari Pertamina, PLN, Waskita, WIKA, Adhi Karya, Hutama Karya",
  },
  {
    id: "pln-procurement",
    name: "PLN e-Procurement",
    url: "https://eproc.pln.co.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Tender konstruksi infrastruktur kelistrikan PLN — pembangkit, transmisi, distribusi, dan gardu",
  },
  {
    id: "pertamina-eprocure",
    name: "Pertamina e-Procurement",
    url: "https://eprocure.pertamina.com/",
    category: "TENDER_OPPORTUNITY",
    description: "Pengadaan konstruksi Pertamina Group — kilang, pipa, tangki, dan fasilitas migas",
  },
  {
    id: "bpjt-tol",
    name: "BPJT — Badan Pengatur Jalan Tol",
    url: "https://bpjt.pu.go.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Data investasi dan konstruksi jalan tol — lelang konsesi, paket sipil, dan peluang mitra konstruksi",
  },
  {
    id: "tender-bumn-infra",
    name: "Waskita Karya Tender",
    url: "https://www.waskita.co.id/pengadaan/",
    category: "TENDER_OPPORTUNITY",
    description: "Pengadaan subkontraktor Waskita Karya — paket pekerjaan sipil, mekanikal, dan spesialis",
  },
  {
    id: "hutama-karya-procurement",
    name: "Hutama Karya Pengadaan",
    url: "https://hutamakarya.com/pengadaan/",
    category: "TENDER_OPPORTUNITY",
    description: "Pengadaan subkontraktor Hutama Karya — proyek Tol Trans Sumatera dan infrastruktur strategis nasional",
  },
  {
    id: "kai-procurement",
    name: "KAI — Pengadaan Infrastruktur",
    url: "https://procurement.kai.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Tender konstruksi KAI — stasiun, depo, jalur rel, dan infrastruktur perkeretaapian",
  },
  {
    id: "eppid-ikn",
    name: "IKN Nusantara — Tender & Investasi",
    url: "https://www.ikn.go.id/",
    category: "TENDER_OPPORTUNITY",
    description: "Peluang tender dan investasi Ibu Kota Nusantara — gedung pemerintah, infrastruktur, kawasan hunian ASN",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // KONTRAKTOR, SBU & PERIZINAN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "lpjk-pupr",
    name: "LPJK PUPR — Database SBU",
    url: "https://lpjk.pu.go.id/",
    category: "CONTRACTOR_DATA",
    description: "Database SBU kontraktor, konsultan, dan SKK aktif/kadaluarsa dari Lembaga Pengembangan Jasa Konstruksi",
  },
  {
    id: "lpjk-smap",
    name: "LPJK — Ketidaksesuaian SMAP",
    url: "https://lpjk.pu.go.id/laporan-lpjk/ketidaksesuaian-smap",
    category: "CONTRACTOR_DATA",
    description: "Daftar BUJK yang belum memenuhi komitmen SMAP SNI ISO 37001:2016 — prospek layanan prioritas tinggi",
  },
  {
    id: "oss-rba",
    name: "OSS-RBA — Perizinan BUJK",
    url: "https://oss.go.id/informasi/kbli-berbasis-risiko",
    category: "CONTRACTOR_DATA",
    description: "Perizinan berusaha BUJK via OSS — status Sertifikat Standar, NIB, dan perubahan KBLI konstruksi",
  },
  {
    id: "ijintender",
    name: "IjinTender.co.id",
    url: "https://www.ijintender.co.id/",
    category: "CONTRACTOR_DATA",
    description: "Platform pengurusan SBU, SKK, IUJK, NIB, dan pendampingan tender LPSE/SPSE — data harga dan proses pengurusan",
  },
  {
    id: "indokontraktor",
    name: "IndoKontraktor",
    url: "https://www.indokontraktor.com/",
    category: "CONTRACTOR_DATA",
    description: "Direktori kontraktor dan konsultan Indonesia dengan profil SBU, subklasifikasi, dan masa berlaku",
  },
  {
    id: "gapensi",
    name: "GAPENSI — Gabungan Pelaksana Konstruksi",
    url: "https://www.gapensi.or.id/",
    category: "CONTRACTOR_DATA",
    description: "Asosiasi kontraktor nasional — keanggotaan, data BUJK Kecil/Menengah/Besar, isu regulasi, dan pelatihan",
  },
  {
    id: "gapeksindo",
    name: "GAPEKSINDO",
    url: "https://www.gapeksindo.or.id/",
    category: "CONTRACTOR_DATA",
    description: "Gabungan Pengusaha Konstruksi Indonesia — data anggota kontraktor sipil dan advokasi regulasi SBU",
  },
  {
    id: "inkindo",
    name: "INKINDO — Konsultan Indonesia",
    url: "https://www.inkindo.org/",
    category: "CONTRACTOR_DATA",
    description: "Ikatan Nasional Konsultan Indonesia — database konsultan, regulasi SBU konsultan, dan peluang jasa konsultansi",
  },
  {
    id: "aspekindo",
    name: "ASPEKINDO",
    url: "https://www.aspekindo.or.id/",
    category: "CONTRACTOR_DATA",
    description: "Asosiasi Perusahaan Konstruksi Indonesia — data perusahaan spesialis dan tren kebutuhan subkontraktor",
  },
  {
    id: "sertifikasi-pupr",
    name: "Sertifikasi PUPR — Portal SKA/SKT",
    url: "https://sertifikasi.pu.go.id/",
    category: "CONTRACTOR_DATA",
    description: "Portal sertifikasi tenaga ahli dan tenaga terampil PUPR — status aktif, kadaluarsa, dan jadwal ujian",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SKK, SERTIFIKASI & TENAGA KERJA KONSTRUKSI
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "kemnaker",
    name: "Kementerian Ketenagakerjaan",
    url: "https://www.kemnaker.go.id/",
    category: "SKK_HOLDERS",
    description: "Data sertifikasi kompetensi kerja konstruksi dari Kemnaker — SKK jenjang 7/8/9",
  },
  {
    id: "sibima-pupr",
    name: "SIBIMA PUPR",
    url: "https://sibima.pu.go.id/",
    category: "SKK_HOLDERS",
    description: "Sistem Informasi Belajar Intensif Mandiri PUPR — jadwal ujian SKK, pemegang sertifikat aktif",
  },
  {
    id: "bnsp",
    name: "BNSP — Badan Nasional Sertifikasi Profesi",
    url: "https://bnsp.go.id/",
    category: "SKK_HOLDERS",
    description: "Database LSP konstruksi terlisensi BNSP, skema sertifikasi, dan daftar asesor kompetensi nasional",
  },
  {
    id: "lsp-konstruksi",
    name: "LSP-KI — Lembaga Sertifikasi Profesi Konstruksi",
    url: "https://lspkonstruksi.com/",
    category: "SKK_HOLDERS",
    description: "Jadwal sertifikasi SKK, paket uji kompetensi, dan data pemegang sertifikat per bidang keahlian",
  },
  {
    id: "tukang-com",
    name: "Tukang.com",
    url: "https://www.tukang.com/",
    category: "SKK_HOLDERS",
    description: "Platform tenaga kerja konstruksi — kebutuhan, masalah sertifikasi, dan pasar SKK jenjang bawah",
  },
  {
    id: "bpjamsostek-jkk",
    name: "BPJS Ketenagakerjaan — Konstruksi",
    url: "https://www.bpjsketenagakerjaan.go.id/konstruksi.html",
    category: "SKK_HOLDERS",
    description: "Data kepesertaan JKK konstruksi — proyek yang terdaftar, kepatuhan BUJK, dan kasus kecelakaan kerja",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // REGULASI, KEBIJAKAN & STANDAR
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "pupr-berita",
    name: "PUPR — Berita & Regulasi",
    url: "https://www.pu.go.id/berita",
    category: "TREND_SOSMED",
    description: "Berita resmi Kementerian PUPR — perubahan regulasi SBU, SKK, Permen PUPR, dan kebijakan pengadaan konstruksi",
  },
  {
    id: "esdm",
    name: "Kementerian ESDM",
    url: "https://www.esdm.go.id/",
    category: "TREND_SOSMED",
    description: "Regulasi dan berita sektor energi dan mineral — kebijakan EBT, konstruksi PLTS, dan infrastruktur migas",
  },
  {
    id: "bsn-sni",
    name: "BSN — Standar Nasional Indonesia",
    url: "https://www.bsn.go.id/",
    category: "TREND_SOSMED",
    description: "Publikasi SNI konstruksi terbaru — beton, baja, K3, SMAP, dan standar material bangunan",
  },
  {
    id: "jdih-pupr",
    name: "JDIH PUPR — Peraturan Konstruksi",
    url: "https://jdih.pu.go.id/",
    category: "TREND_SOSMED",
    description: "Database Peraturan Menteri PUPR, Permen, Kepmen, dan SE terbaru terkait jasa konstruksi",
  },
  {
    id: "ojk-properti",
    name: "OJK — Data KPR & Pembiayaan Properti",
    url: "https://www.ojk.go.id/id/kanal/perbankan/Pages/Rekapitulasi-Data-KPR-KPRS.aspx",
    category: "TREND_SOSMED",
    description: "Data KPR dan KPA bulanan dari OJK — volume pembiayaan properti, pertumbuhan demand hunian, dan tren pasar",
  },
  {
    id: "bappenas-proyek",
    name: "Bappenas — Proyek Prioritas Nasional",
    url: "https://kpbu.bappenas.go.id/",
    category: "TREND_SOSMED",
    description: "Daftar Proyek Strategis Nasional (PSN) dan KPBU — peluang konstruksi infrastruktur skala besar",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // MEDIA INDUSTRI KONSTRUKSI & PROPERTI
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "media-konstruksi",
    name: "Media Konstruksi Indonesia",
    url: "https://www.mediakonstruksi.com/",
    category: "TREND_SOSMED",
    description: "Berita industri konstruksi Indonesia — proyek besar, regulasi, material, teknologi, dan profil perusahaan",
  },
  {
    id: "majalah-konstruksi",
    name: "Majalah Konstruksi",
    url: "https://www.majalahkonstruksi.com/",
    category: "TREND_SOSMED",
    description: "Publikasi industri konstruksi Indonesia — tren teknologi, proyek unggulan, dan wawancara pelaku industri",
  },
  {
    id: "properti-kompas",
    name: "Kompas Properti",
    url: "https://properti.kompas.com/",
    category: "TREND_SOSMED",
    description: "Berita properti dan konstruksi dari Kompas — tren hunian, regulasi, dan perkembangan kawasan baru",
  },
  {
    id: "bisnis-infrastruktur",
    name: "Bisnis.com — Infrastruktur",
    url: "https://ekonomi.bisnis.com/infrastruktur",
    category: "TREND_SOSMED",
    description: "Berita investasi infrastruktur, konstruksi BUMN, dan kebijakan pengadaan dari Bisnis Indonesia",
  },
  {
    id: "katadata-konstruksi",
    name: "Katadata — Infrastruktur & Konstruksi",
    url: "https://katadata.co.id/tag/infrastruktur",
    category: "TREND_SOSMED",
    description: "Data dan analitik sektor infrastruktur — anggaran, realisasi, nilai kontrak, dan proyeksi pertumbuhan",
  },
  {
    id: "cnbc-infrastruktur",
    name: "CNBC Indonesia — Infrastruktur",
    url: "https://www.cnbcindonesia.com/tag/infrastruktur",
    category: "TREND_SOSMED",
    description: "Berita pasar dan korporasi sektor konstruksi dan properti dari perspektif investasi dan keuangan",
  },
  {
    id: "kontan-properti",
    name: "Kontan.co.id — Properti & Konstruksi",
    url: "https://industri.kontan.co.id/properti",
    category: "TREND_SOSMED",
    description: "Analisis keuangan dan korporasi sektor konstruksi — kinerja emiten BUMN konstruksi, IPO, dan ekspansi",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // PASAR PROPERTI & PELUANG PERMINTAAN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "mitrarenov",
    name: "MitraRenov",
    url: "https://www.mitrarenov.com/",
    category: "OPPORTUNITY_TREND",
    description: "Platform renovasi hunian — data permintaan aktif jasa konstruksi dan renovasi dari pemilik properti",
  },
  {
    id: "renovasyk",
    name: "Renovasyk",
    url: "https://www.renovasyk.com/",
    category: "OPPORTUNITY_TREND",
    description: "Marketplace jasa renovasi — tren permintaan, harga pasar, dan layanan populer di segmen hunian",
  },
  {
    id: "sejasa-com",
    name: "Sejasa.com",
    url: "https://www.sejasa.com/",
    category: "OPPORTUNITY_TREND",
    description: "Marketplace jasa konstruksi dan renovasi — permintaan real-time dari pemilik properti dan developer",
  },
  {
    id: "rumah-com",
    name: "Rumah.com — Indeks Properti",
    url: "https://www.rumah.com/panduan-properti/indeks-harga-properti",
    category: "OPPORTUNITY_TREND",
    description: "Indeks harga properti bulanan — tren harga, lokasi hot, dan pertumbuhan demand hunian per kota",
  },
  {
    id: "lamudi",
    name: "Lamudi.co.id — Analitik Properti",
    url: "https://www.lamudi.co.id/research/",
    category: "OPPORTUNITY_TREND",
    description: "Riset pasar properti Lamudi — laporan supply/demand, harga, dan tren segmentasi properti komersial/hunian",
  },
  {
    id: "99co",
    name: "99.co Indonesia — Tren Properti",
    url: "https://www.99.co/id/panduan/pasar-properti",
    category: "OPPORTUNITY_TREND",
    description: "Data pasar properti dan permintaan jasa konstruksi dari platform listing properti nasional",
  },
  {
    id: "indonesia-property-watch",
    name: "Indonesia Property Watch",
    url: "https://www.indonesiapropertywatch.com/",
    category: "OPPORTUNITY_TREND",
    description: "Riset dan analisis pasar properti Indonesia — kuartal, segmen, harga, dan outlook konstruksi perumahan",
  },
  {
    id: "rei-properti",
    name: "REI — Real Estate Indonesia",
    url: "https://www.rei.or.id/",
    category: "OPPORTUNITY_TREND",
    description: "Asosiasi pengembang properti nasional — data penjualan, rencana pembangunan, dan kebutuhan kontraktor",
  },
  {
    id: "apersi",
    name: "APERSI — Pengembang Perumahan",
    url: "https://www.apersi.or.id/",
    category: "OPPORTUNITY_TREND",
    description: "Asosiasi Pengembang Perumahan Seluruh Indonesia — data developer, backlog perumahan, dan peluang konstruksi hunian",
  },
  {
    id: "bps-konstruksi",
    name: "BPS — Statistik Konstruksi",
    url: "https://www.bps.go.id/subject/18/konstruksi.html",
    category: "OPPORTUNITY_TREND",
    description: "Data resmi statistik sektor konstruksi Indonesia dari BPS — PDB, jumlah perusahaan, tenaga kerja, nilai produksi",
  },
  {
    id: "propertyguru-id",
    name: "PropertyGuru Indonesia",
    url: "https://www.propertyguru.co.id/properti-news/",
    category: "OPPORTUNITY_TREND",
    description: "Berita dan analisis pasar properti regional Asia Tenggara — relevan untuk posisi layanan konstruksi premium",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // KNOWLEDGE BASE, TEMPLATE & PENDIDIKAN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "dokumenproyek",
    name: "DokumenProyek.com",
    url: "https://dokumenproyek.com/",
    category: "KNOWLEDGE_BASE",
    description: "Portal template dokumen proyek konstruksi — RAB, RKS, spesifikasi teknis, gambar standar, dan laporan",
  },
  {
    id: "gustafta",
    name: "Gustafta.my.id",
    url: "https://gustafta.my.id/",
    category: "KNOWLEDGE_BASE",
    description: "Blog konsultasi konstruksi dan SBU — artikel regulasi terbaru, trik pengurusan SBU/SKK, dan template",
  },
  {
    id: "teknik-sipil-id",
    name: "TeknikSipil.id",
    url: "https://tekniksipil.id/",
    category: "KNOWLEDGE_BASE",
    description: "Portal teknik sipil Indonesia — standar SNI, metode konstruksi, RAB, dan panduan teknis proyek",
  },
  {
    id: "ilmu-sipil",
    name: "Ilmu Sipil",
    url: "https://www.ilmusipil.com/",
    category: "KNOWLEDGE_BASE",
    description: "Referensi teknis konstruksi — analisa harga satuan, spesifikasi material, dan tutorial software konstruksi",
  },
  {
    id: "pusdiklat-pupr",
    name: "PUSDIKLAT PUPR — Materi Pelatihan",
    url: "https://bpsdm.pu.go.id/",
    category: "KNOWLEDGE_BASE",
    description: "Badan Pengembangan SDM PUPR — modul pelatihan, e-learning SKK, dan kurikulum konstruksi resmi",
  },
  {
    id: "konstruksi-kontan",
    name: "Forum Konstruksi Kaskus",
    url: "https://www.kaskus.co.id/forum/188/properti/",
    category: "KNOWLEDGE_BASE",
    description: "Forum diskusi properti dan konstruksi — keluhan pasar nyata, pertanyaan subkontraktor, kebutuhan tersembunyi",
  },
  {
    id: "google-trends-konstruksi",
    name: "Google Trends — Konstruksi Indonesia",
    url: "https://trends.google.co.id/trends/explore?geo=ID&q=konstruksi,tender,SBU,kontraktor",
    category: "KNOWLEDGE_BASE",
    description: "Tren pencarian kata kunci industri konstruksi di Indonesia — sinyal minat pasar dan pertumbuhan topik",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // SOSIAL MEDIA & SINYAL PASAR
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "instagram-konstruksi",
    name: "Instagram — #KonstruksiIndonesia",
    url: "https://www.instagram.com/explore/tags/konstruksiindonesia/",
    category: "TREND_SOSMED",
    description: "Konten UGC konstruksi dari lapangan — tren visual, keluhan proyek, inovasi material, dan viral construction content",
  },
  {
    id: "linkedin-jasa-konstruksi",
    name: "LinkedIn — Grup Jasa Konstruksi Indonesia",
    url: "https://www.linkedin.com/search/results/groups/?keywords=konstruksi+indonesia",
    category: "TREND_SOSMED",
    description: "Diskusi profesional konstruksi di LinkedIn — isu procurement, SDM, regulasi, dan partnership B2B",
  },
  {
    id: "youtube-konstruksi",
    name: "YouTube — Channel Konstruksi Nasional",
    url: "https://www.youtube.com/results?search_query=konstruksi+indonesia+proyek",
    category: "TREND_SOSMED",
    description: "Konten video proyek konstruksi Indonesia — dokumentasi, tutorial, profil BUJK, dan liputan tender besar",
  },
  {
    id: "tiktok-kontraktor",
    name: "TikTok — Konten Kontraktor & Renovasi",
    url: "https://www.tiktok.com/tag/kontraktor",
    category: "TREND_SOSMED",
    description: "Tren viral seputar renovasi dan konstruksi di TikTok — sinyal demand segmen milenial dan pemilik rumah muda",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER EBT — ENERGI BARU TERBARUKAN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "pln-eproc-ebt",
    name: "PLN e-Procurement — Tender EBT",
    url: "https://eproc.pln.co.id/",
    category: "EBT_TENDER_PLN",
    description: "Tender PLN untuk PLTS, PLTB, PLTA, PLTM, storage, dan transmisi — sumber utama pipeline EBT Indonesia",
  },
  {
    id: "esdm-ebt",
    name: "ESDM — Direktorat Energi Baru Terbarukan",
    url: "https://ebtke.esdm.go.id/",
    category: "EBT_REGULASI",
    description: "Kebijakan, regulasi, dan data statistik EBT dari Ditjen EBTKE Kementerian ESDM",
  },
  {
    id: "ruptl-pln",
    name: "RUPTL PLN — Rencana Usaha Penyediaan Tenaga Listrik",
    url: "https://web.pln.co.id/stakeholder/ruptl",
    category: "EBT_RUPTL",
    description: "Rencana induk pengembangan pembangkit PLN — pipeline proyek EBT 10 tahun ke depan",
  },
  {
    id: "iesr-ebt",
    name: "IESR — Institute for Essential Services Reform",
    url: "https://iesr.or.id/en/category/renewable-energy",
    category: "EBT_RISET",
    description: "Laporan riset independen tentang transisi energi Indonesia — analisis EBT, kebijakan, dan investasi",
  },
  {
    id: "cnbc-energi",
    name: "CNBC Indonesia — Energi & Tambang",
    url: "https://www.cnbcindonesia.com/tag/energi",
    category: "EBT_BERITA",
    description: "Berita terkini sektor energi Indonesia — proyek EBT, tender PLN, dan kebijakan ESDM",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER PERTAMBANGAN
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "modi-esdm",
    name: "MODI — Minerba One Data Indonesia",
    url: "https://modi.esdm.go.id/",
    category: "MINING_IUP",
    description: "Database IUP (Izin Usaha Pertambangan) resmi dari ESDM — status, pemegang, komoditas, dan wilayah",
  },
  {
    id: "esdm-minerba",
    name: "ESDM — Ditjen Mineral dan Batubara",
    url: "https://www.esdm.go.id/id/media-center/arsip-berita/minerba",
    category: "MINING_REGULASI",
    description: "Berita dan kebijakan sektor minerba dari Kementerian ESDM — perizinan, ekspor, dan RKAB",
  },
  {
    id: "tambang-co-id",
    name: "Tambang.co.id",
    url: "https://www.tambang.co.id/",
    category: "MINING_BERITA",
    description: "Media khusus industri pertambangan Indonesia — berita IUP, produksi, dan tender kontraktor tambang",
  },
  {
    id: "mining-co-id",
    name: "Mining.co.id — Portal Pertambangan",
    url: "https://www.mining.co.id/",
    category: "MINING_BERITA",
    description: "Informasi harga komoditas, proyek pertambangan, dan profil perusahaan tambang Indonesia",
  },
  {
    id: "apbi-batubara",
    name: "APBI — Asosiasi Pertambangan Batubara Indonesia",
    url: "https://www.apbi-icma.org/",
    category: "MINING_ASOSIASI",
    description: "Berita dan data produksi batubara dari asosiasi resmi — sinyal demand dan kebijakan ekspor",
  },

  // ══════════════════════════════════════════════════════════════════════════
  // CLUSTER LINGKUNGAN & TRANSISI ENERGI
  // ══════════════════════════════════════════════════════════════════════════
  {
    id: "klhk-amdal",
    name: "KLHK — AMDAL Net",
    url: "https://amdalnet.menlhk.go.id/",
    category: "ENV_AMDAL",
    description: "Database AMDAL online dari Kementerian Lingkungan Hidup — proyek yang sedang proses izin lingkungan",
  },
  {
    id: "idx-carbon",
    name: "IDX Carbon — Bursa Karbon Indonesia",
    url: "https://idxcarbon.co.id/",
    category: "ENV_KARBON",
    description: "Pasar karbon resmi Indonesia di bawah OJK — transaksi kredit karbon, harga, dan proyek terdaftar",
  },
  {
    id: "klhk-proper",
    name: "KLHK — PROPER (Peringkat Kinerja Lingkungan)",
    url: "https://proper.menlhk.go.id/",
    category: "ENV_PROPER",
    description: "Peringkat kinerja lingkungan perusahaan dari KLHK — Emas/Hijau/Biru/Merah/Hitam",
  },
  {
    id: "greennetwork-id",
    name: "Green Network Indonesia",
    url: "https://greennetwork.id/",
    category: "ENV_BERITA",
    description: "Media khusus berita lingkungan, ESG, dan transisi energi Indonesia — sinyal kebijakan dan proyek hijau",
  },
  {
    id: "mongabay-indonesia",
    name: "Mongabay Indonesia — Lingkungan Hidup",
    url: "https://www.mongabay.co.id/",
    category: "ENV_BERITA",
    description: "Jurnalisme lingkungan hidup Indonesia — deforestasi, izin lingkungan, dan konflik lahan proyek besar",
  },
  {
    id: "bci-asia",
    name: "BCI Central — Project Intelligence",
    url: "https://www.bcicentral.com/id/find-projects/",
    category: "PROYEK",
    description: "Database proyek konstruksi Asia dan Indonesia, termasuk pipeline, nilai proyek, dan kontak pemilik proyek",
  },
  {
    id: "bci-jakarta",
    name: "BCI Central — Jakarta Construction Leads",
    url: "https://www.bcicentral.com/id/local/jakarta-construction-leads/",
    category: "PROYEK",
    description: "Pipeline proyek konstruksi aktif dan tahap awal di wilayah Jakarta",
  },
  {
    id: "citra-data",
    name: "Citra Data Construction",
    url: "https://citradataconstruction.com/",
    category: "SBU",
    description: "Database profil kontraktor dan proyek konstruksi Indonesia",
  },
  {
    id: "top-konstruksi",
    name: "Top Konstruksi — Proyek",
    url: "https://topkonstruksi.com/",
    category: "PROYEK",
    description: "Berita dan informasi proyek konstruksi Indonesia",
  },
  {
    id: "dunia-tender",
    name: "Dunia Tender",
    url: "https://duniatender.com/",
    category: "TENDER",
    description: "Agregator tender dan proyek konstruksi Indonesia",
  },
  {
    id: "simpul-kpbu",
    name: "SIMPUL KPBU PUPR — Proyek",
    url: "https://simpulkpbu.pu.go.id/proyek/operasi",
    category: "PROYEK",
    description: "Portal resmi PUPR untuk proyek KPBU tahap operasi dan konstruksi",
  },
  {
    id: "datalpse",
    name: "DataLPSE.com — Lelang Aktif",
    url: "https://www.datalpse.com/lelang",
    category: "TENDER",
    description: "Agregator data lelang dari berbagai LPSE daerah",
  },
  {
    id: "lkpp-pemenang",
    name: "LKPP — Pemenang Tender Konstruksi",
    url: "https://data.lkpp.go.id/id/dataset/daftar-pemenang-penyedia-tender-pada-kategori-pekerjaan-konstruksi",
    category: "SBU",
    description: "Dataset penyedia pemenang tender pekerjaan konstruksi nasional",
  },
  {
    id: "pengadaan-info",
    name: "Pengadaan.info — Lelang",
    url: "https://pengadaan.info/lelang",
    category: "TENDER",
    description: "Informasi lelang pengadaan konstruksi dari berbagai instansi",
  },
  {
    id: "datalelang-id",
    name: "DataLelang.id",
    url: "https://www.datalelang.id/",
    category: "TENDER",
    description: "Agregator data lelang konstruksi aktif dan historis",
  },
];
