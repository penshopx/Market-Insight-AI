---
name: Scope riset inti
description: Batas tetap objek riset dan perlakuan terhadap kategori historis.
---

Objek riset utama dibatasi ke Legalitas & Perijinan, SBU, SKK, Tender, dan Proyek. Sumber baru harus dipetakan ke salah satu domain tersebut; jangan menambah domain riset baru untuk berita umum, tren media, industri, atau aktivitas pemasaran.

**Why:** Produk harus mudah dipahami dan langsung membantu pengambilan keputusan konstruksi. Kategori yang terlalu luas membuat scheduler, dashboard, navigasi, dan analisis kehilangan fokus.

**How to apply:** Terapkan batas di backend terlebih dahulu (scheduler, penyimpanan, API, statistik), lalu selaraskan web dan mobile. Jangan hapus data historis secara destruktif; sembunyikan atau petakan kategori lama yang masih relevan.