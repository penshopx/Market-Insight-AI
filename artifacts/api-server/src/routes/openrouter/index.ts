import { Router } from "express";
import { db } from "@workspace/db";
import { conversations, messages } from "@workspace/db";
import { openrouter } from "@workspace/integrations-openrouter-ai";
import { eq } from "drizzle-orm";

const router = Router();

const SYSTEM_PROMPT = `Kamu adalah INTEL-AI, asisten kecerdasan buatan untuk Platform Riset Marketing Konstruksi Indonesia (INTEL-KONSTRUKSI) milik PT. Maheswara Jaya Persada.

## Tugas utamamu:
1. Membantu tim memahami dan membaca data riset yang ada di platform
2. Menjawab pertanyaan tentang fitur dan cara penggunaan platform
3. Memberikan panduan analisis data konstruksi Indonesia
4. Membantu merumuskan strategi berdasarkan data

## Modul platform yang tersedia:
- **Dashboard Harian**: Ringkasan sinkronisasi otomatis jam 07:00 WIB — trending topics, tender baru, sertifikasi expiring
- **Data Riset**: 64+ sumber dikumpulkan otomatis — tender BUMN, SBU, SKK, regulasi, sinyal pasar
- **Database Kontraktor**: Profil BUJK, SBU aktif, subklasifikasi, tanggal kadaluarsa
- **Pemegang SKK**: Sertifikat SKK jenjang 7/8/9 — validitas dan peluang pelatihan
- **Peluang Tender**: Monitoring LPSE/SPSE nasional — nilai HPS, deadline, risiko
- **Perumusan Masalah (Pain Points)**: Masalah pasar dengan skor urgent 1–10
- **Master Knowledge Registry (MKR)**: 64 knowledge assets dengan ROI dan coverage
- **Laporan Intelijen**: Gabungan regulasi + kompetitor + sinyal pasar dalam 1 brief
- **Radar Kompetitor**: Analisis IjinTender.co.id dan 7 kompetitor lain
- **Sinyal Pasar & VOC**: Voice of Customer dari lapangan
- **AI Rekomendasi**: 9 agen AI spesialisasi (TenderClaw, SKKClaw, dll)
- **Output Produk**: Katalog layanan — SBU, SKK, ISO, SMAP
- **Surat Penawaran**: Generator surat penawaran langsung dari katalog
- **Workroom**: Ruang kerja tim dengan notes dan sinkronisasi
- **Papan Inspirasi**: Peluang bisnis dari silang data pain points

## Cara membaca data:
- **Pain Score 1–10**: Semakin tinggi = semakin urgent, prioritaskan > 7
- **HPS Tender**: Harga Perkiraan Sendiri — batas maksimal penawaran yang boleh diajukan
- **SKK Jenjang 7/8/9**: 7=Operator, 8=Teknisi, 9=Ahli — jenjang 9 paling dicari
- **SBU**: Sertifikat Badan Usaha — wajib untuk ikut tender pemerintah
- **TKDN**: Tingkat Komponen Dalam Negeri — makin tinggi makin diutamakan
- **SMAP**: Sistem Manajemen Anti Penyuapan ISO 37001
- **BUJK**: Badan Usaha Jasa Konstruksi — kontraktor yang terdaftar LPJK
- **ROI Knowledge Asset**: Estimasi nilai bisnis yang bisa dihasilkan per aset

## Panduan navigasi:
- Mulai dari Dashboard untuk overview harian
- Gunakan MKR untuk memahami sumber data yang tersedia
- Laporan Intelijen untuk brief singkat sebelum meeting klien
- Pain Points untuk identifikasi layanan yang paling dibutuhkan pasar
- Workroom untuk kolaborasi tim dan menyimpan catatan

Jawab selalu dalam Bahasa Indonesia. Singkat, padat, dan actionable. Gunakan bullet points untuk kejelasan.`;

// GET /openrouter/conversations
router.get("/openrouter/conversations", async (_req, res) => {
  try {
    const convs = await db
      .select()
      .from(conversations)
      .orderBy(conversations.createdAt);
    res.json(convs.map(c => ({ ...c, createdAt: c.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /openrouter/conversations
router.post("/openrouter/conversations", async (req, res) => {
  try {
    const { title, model } = req.body as { title: string; model: string };
    const [conv] = await db
      .insert(conversations)
      .values({ title, model: model || "openai/gpt-4o-2024-11-20" })
      .returning();
    res.status(201).json({ ...conv, createdAt: conv.createdAt.toISOString() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /openrouter/conversations/:id
router.get("/openrouter/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, id));
    if (!conv) return void res.status(404).json({ error: "Not found" });
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, id))
      .orderBy(messages.createdAt);
    res.json({
      ...conv,
      createdAt: conv.createdAt.toISOString(),
      messages: msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })),
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// DELETE /openrouter/conversations/:id
router.delete("/openrouter/conversations/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [conv] = await db
      .delete(conversations)
      .where(eq(conversations.id, id))
      .returning();
    if (!conv) return void res.status(404).json({ error: "Not found" });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// GET /openrouter/conversations/:id/messages
router.get("/openrouter/conversations/:id/messages", async (req, res) => {
  try {
    const convId = Number(req.params.id);
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, convId))
      .orderBy(messages.createdAt);
    res.json(msgs.map(m => ({ ...m, createdAt: m.createdAt.toISOString() })));
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /openrouter/conversations/:id/messages  — SSE stream
router.post("/openrouter/conversations/:id/messages", async (req, res) => {
  const convId = Number(req.params.id);
  const { content, model } = req.body as { content: string; model?: string };

  const [conv] = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, convId));
  if (!conv) return void res.status(404).json({ error: "Not found" });

  // Save user message
  await db.insert(messages).values({ conversationId: convId, role: "user", content });

  // Build history
  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, convId))
    .orderBy(messages.createdAt);

  const chatMessages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  ];

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  let fullResponse = "";
  const modelToUse = model || conv.model;

  try {
    const stream = await openrouter.chat.completions.create({
      model: modelToUse,
      max_tokens: 8192,
      messages: chatMessages,
      stream: true,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullResponse += delta;
        res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
      }
    }

    await db.insert(messages).values({
      conversationId: convId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    console.error("OpenRouter stream error:", err);
    res.write(`data: ${JSON.stringify({ error: "AI tidak tersedia saat ini. Coba lagi." })}\n\n`);
  }

  res.end();
});

export default router;
