import { Router, type IRouter } from "express";
import { db, researchItemsTable } from "@workspace/db";
import {
  FetchDataSourceBody,
  FetchDataSourceResponse,
  ListDataSourcesResponse,
} from "@workspace/api-zod";
import { CORE_DATA_SOURCES, isCoreResearchCategory } from "../lib/researchScope";

const router: IRouter = Router();

router.get("/data-collector/sources", async (_req, res): Promise<void> => {
  res.json(ListDataSourcesResponse.parse(
    CORE_DATA_SOURCES.map((s) => ({ ...s, lastFetched: null }))
  ));
});

router.post("/data-collector/fetch", async (req, res): Promise<void> => {
  const parsed = FetchDataSourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { url, sourceLabel, category, saveToCategory } = parsed.data;
  if ((category && !isCoreResearchCategory(category)) || (saveToCategory && !isCoreResearchCategory(saveToCategory))) {
    res.status(400).json({
      error: "Kategori di luar fokus riset. Gunakan Legalitas & Perijinan, SBU, SKK, Tender, atau Proyek.",
    });
    return;
  }
  const fetchedAt = new Date().toISOString();

  try {
    // Server-side fetch with a realistic browser User-Agent
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate",
        "Cache-Control": "no-cache",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      res.json(FetchDataSourceResponse.parse({
        url,
        sourceLabel: sourceLabel ?? new URL(url).hostname,
        status: "BLOCKED",
        fetchedAt,
        title: null,
        items: [],
        rawSummary: `HTTP ${response.status}: ${response.statusText}`,
        errorMessage: `Server returned ${response.status}`,
      }));
      return;
    }

    const html = await response.text();

    // Extract page title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    const pageTitle = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : null;

    // Extract text content — strip scripts, styles, nav
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract meaningful text blocks (sentences with construction keywords)
    const keywords = [
      "konstruksi", "kontraktor", "konsultan", "tender", "SBU", "SKK", "LPJK",
      "pengadaan", "lelang", "sertifikat", "jasa", "bangunan", "proyek",
      "infrastruktur", "renovasi", "sipil", "gedung", "jalan", "pekerjaan"
    ];

    const sentences = cleaned
      .split(/[.!?\n]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 30 && s.length < 500)
      .filter((s) => keywords.some((kw) => s.toLowerCase().includes(kw.toLowerCase())));

    // Build extracted items — deduplicate and take top 15
    const seen = new Set<string>();
    const extractedItems: Array<{ title: string; content: string; url: string | null; category: string | null; savedAsResearchItem: boolean }> = [];

    for (const sentence of sentences.slice(0, 20)) {
      const key = sentence.substring(0, 60).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      let savedAsResearchItem = false;

      // Auto-save to research_items if requested
      if (saveToCategory) {
        const inserted = await db
          .insert(researchItemsTable)
          .values({
            category: saveToCategory,
            title: sentence.substring(0, 200),
            summary: sentence,
            source: sourceLabel ?? new URL(url).hostname,
            sourceUrl: url,
            dataSourceSite: new URL(url).hostname,
            status: "PENDING",
            priority: "MEDIUM",
            collectedAt: new Date().toISOString().split("T")[0],
          })
          .onConflictDoNothing()
          .returning({ id: researchItemsTable.id });
        savedAsResearchItem = inserted.length > 0;
      }

      extractedItems.push({
        title: sentence.substring(0, 120),
        content: sentence,
        url: null,
        category: category ?? null,
        savedAsResearchItem,
      });

      if (extractedItems.length >= 15) break;
    }

    const rawSummary = cleaned.substring(0, 800);

    res.json(FetchDataSourceResponse.parse({
      url,
      sourceLabel: sourceLabel ?? new URL(url).hostname,
      status: extractedItems.length > 0 ? "SUCCESS" : "PARTIAL",
      fetchedAt,
      title: pageTitle,
      items: extractedItems,
      rawSummary,
      errorMessage: null,
    }));

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const isTimeout = message.includes("abort") || message.includes("timeout");

    res.json(FetchDataSourceResponse.parse({
      url,
      sourceLabel: sourceLabel ?? (url.includes("://") ? new URL(url).hostname : url),
      status: "ERROR",
      fetchedAt,
      title: null,
      items: [],
      rawSummary: null,
      errorMessage: isTimeout
        ? "Timeout: situs tidak merespons dalam 15 detik"
        : `Error: ${message}`,
    }));
  }
});

export default router;
