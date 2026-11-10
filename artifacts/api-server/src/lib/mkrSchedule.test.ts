/**
 * Unit tests for mkrSchedule scheduling logic.
 *
 * Tests cover:
 *   - msUntilNextHighPriorityRun: boundaries at 0, 6, 12, 18 h UTC
 *   - getNextScheduledAt: correct next-run times for each frequency tier
 *   - No duplicate execution: standard batch excludes high-priority sources
 *
 * Run: node --require tsx/esm --test src/lib/mkrSchedule.test.ts
 * (or via `pnpm test` in this package)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  msUntilNextHighPriorityRun,
  getNextScheduledAt,
  getHighPrioritySourceIds,
  getStandardCrawlSourceIds,
  getNeverCrawledSourceIds,
  getScheduleMatrix,
  isHighPrioritySource,
} from "./mkrSchedule.js";
import type { DataSourceConfig } from "./dataSources.js";

// ─── msUntilNextHighPriorityRun ───────────────────────────────────────────────

describe("msUntilNextHighPriorityRun", () => {
  const H = 60 * 60 * 1000;

  it("returns 6 h when exactly at a 6-h boundary (00:00 UTC)", () => {
    const at = new Date("2026-08-03T00:00:00.000Z");
    const ms = msUntilNextHighPriorityRun(at);
    assert.equal(ms, 6 * H);
  });

  it("returns 6 h when exactly at the 06:00 UTC boundary", () => {
    const at = new Date("2026-08-03T06:00:00.000Z");
    const ms = msUntilNextHighPriorityRun(at);
    assert.equal(ms, 6 * H);
  });

  it("returns ~3 h when 3 h past a boundary (e.g. 03:00 UTC → next at 06:00)", () => {
    const at = new Date("2026-08-03T03:00:00.000Z");
    const ms = msUntilNextHighPriorityRun(at);
    assert.equal(ms, 3 * H);
  });

  it("returns ~1 h from the last second before a boundary", () => {
    const at = new Date("2026-08-03T11:59:59.999Z");
    const ms = msUntilNextHighPriorityRun(at);
    // should be 1 ms until 12:00 UTC
    assert.equal(ms, 1);
  });

  it("returns ~5.5 h at 00:30 UTC (30 min past 00:00 boundary)", () => {
    const at = new Date("2026-08-03T00:30:00.000Z");
    const ms = msUntilNextHighPriorityRun(at);
    assert.equal(ms, 5.5 * H);
  });
});

// ─── getNextScheduledAt ───────────────────────────────────────────────────────

describe("getNextScheduledAt", () => {
  const H = 60 * 60 * 1000;

  it("SKIP returns null", () => {
    const result = getNextScheduledAt("SKIP", 5, new Date());
    assert.equal(result, null);
  });

  it("HARIAN businessValue >= 9: returns next 6-hour boundary", () => {
    // At 03:00 UTC, next boundary is 06:00 UTC
    const from = new Date("2026-08-03T03:00:00.000Z");
    const result = getNextScheduledAt("HARIAN", 9, from);
    assert.ok(result !== null);
    assert.equal(new Date(result).toISOString(), "2026-08-03T06:00:00.000Z");
  });

  it("REALTIME businessValue >= 9: returns next 6-hour boundary (same as HARIAN high-BV)", () => {
    const from = new Date("2026-08-03T09:00:00.000Z");
    const result = getNextScheduledAt("REALTIME", 10, from);
    assert.ok(result !== null);
    assert.equal(new Date(result).toISOString(), "2026-08-03T12:00:00.000Z");
  });

  it("HARIAN businessValue < 9: returns next 00:00 UTC (tomorrow if past)", () => {
    // At 03:00 UTC (10:00 WIB), today's 07:00 WIB (00:00 UTC) already passed
    const from = new Date("2026-08-03T03:00:00.000Z");
    const result = getNextScheduledAt("HARIAN", 7, from);
    assert.ok(result !== null);
    assert.equal(new Date(result).toISOString(), "2026-08-04T00:00:00.000Z");
  });

  it("HARIAN businessValue < 9: returns today's 00:00 UTC when called before it", () => {
    // At 23:30 UTC the day before
    const from = new Date("2026-08-02T23:30:00.000Z");
    const result = getNextScheduledAt("HARIAN", 7, from);
    assert.ok(result !== null);
    assert.equal(new Date(result).toISOString(), "2026-08-03T00:00:00.000Z");
  });

  it("MINGGUAN: returns next Monday at 00:00 UTC", () => {
    // 2026-08-03 is a Monday. At 03:00 UTC (after the 00:00 boundary), next Mon is Aug 10
    const from = new Date("2026-08-03T03:00:00.000Z");
    const result = getNextScheduledAt("MINGGUAN", 6, from);
    assert.ok(result !== null);
    // Should be next Monday 2026-08-10
    assert.equal(new Date(result).getUTCDay(), 1); // Monday
    assert.ok(new Date(result) > from);
  });

  it("BULANAN: returns 1st of next month at 00:00 UTC when past the 1st", () => {
    const from = new Date("2026-08-03T03:00:00.000Z"); // 3rd August, past the 1st
    const result = getNextScheduledAt("BULANAN", 5, from);
    assert.ok(result !== null);
    assert.equal(new Date(result).toISOString(), "2026-09-01T00:00:00.000Z");
  });
});

// ─── No-duplicate guarantee ───────────────────────────────────────────────────

describe("standard vs high-priority source separation", () => {
  /** A minimal DataSourceConfig factory. */
  function makeSource(id: string): DataSourceConfig {
    return { id, name: id, url: `https://${id}.example.com`, description: "", category: "TENDER" as const };
  }

  it("getHighPrioritySourceIds contains only sources with businessValue >= 9 and HARIAN/REALTIME", () => {
    const sources = [
      makeSource("spse-inaproc"),    // BV 10, HARIAN  → high-priority
      makeSource("lpse-kemenpupr"),  // BV 10, HARIAN  → high-priority
      makeSource("bpjt-tol"),        // BV  7, MINGGUAN → standard
      makeSource("aspekindo"),       // BV  5, BULANAN  → standard
    ];
    const ids = getHighPrioritySourceIds(sources);
    assert.ok(ids.includes("spse-inaproc"), "spse-inaproc should be high-priority");
    assert.ok(ids.includes("lpse-kemenpupr"), "lpse-kemenpupr should be high-priority");
    assert.ok(!ids.includes("bpjt-tol"), "bpjt-tol should NOT be high-priority");
    assert.ok(!ids.includes("aspekindo"), "aspekindo should NOT be high-priority");
  });

  it("isHighPrioritySource correctly identifies tier-1 sources", () => {
    assert.equal(isHighPrioritySource({ frequency: "HARIAN", priority: 1, mkrSourceId: "x", businessValue: 10 }), true);
    assert.equal(isHighPrioritySource({ frequency: "HARIAN", priority: 2, mkrSourceId: "x", businessValue: 9 }), true);
    assert.equal(isHighPrioritySource({ frequency: "HARIAN", priority: 2, mkrSourceId: "x", businessValue: 8 }), false);
    assert.equal(isHighPrioritySource({ frequency: "MINGGUAN", priority: 3, mkrSourceId: "x", businessValue: 9 }), false);
    assert.equal(isHighPrioritySource({ frequency: "BULANAN", priority: 4, mkrSourceId: "x", businessValue: 10 }), false);
  });

  it("getStandardCrawlSourceIds never overlaps with getHighPrioritySourceIds", () => {
    // Use a Monday so MINGGUAN sources are also due
    const monday = new Date("2026-08-03T00:00:00.000Z"); // Monday
    const sources = [
      makeSource("spse-inaproc"),    // BV 10, HARIAN  → high-priority
      makeSource("lpse-kemenpupr"),  // BV 10, HARIAN  → high-priority
      makeSource("indotender"),      // BV  8, HARIAN  → standard
      makeSource("bpjt-tol"),        // BV  7, MINGGUAN → standard (due Mondays)
    ];
    const highIds = new Set(getHighPrioritySourceIds(sources));
    const standardIds = getStandardCrawlSourceIds(sources, monday);

    // No source should appear in both sets
    for (const id of standardIds) {
      assert.ok(!highIds.has(id), `Source "${id}" appears in BOTH standard and high-priority batches — duplicate execution risk`);
    }

    // High-priority sources must NOT be in the standard batch
    assert.ok(!standardIds.includes("spse-inaproc"), "spse-inaproc must be excluded from standard daily batch");
    assert.ok(!standardIds.includes("lpse-kemenpupr"), "lpse-kemenpupr must be excluded from standard daily batch");

    // Standard source must be in the standard batch (if due today)
    assert.ok(standardIds.includes("indotender"), "indotender (BV 8) should be in the standard daily batch");
  });
});

describe("never-crawled source selection", () => {
  function makeSource(id: string): DataSourceConfig {
    return {
      id,
      name: `Source ${id}`,
      url: `https://${id}.example.com`,
      description: `Description ${id}`,
      category: "TENDER",
    };
  }

  it("selects only sources without successful crawl history", () => {
    const sources = [makeSource("spse-inaproc"), makeSource("lpse-kemenpupr"), makeSource("indotender")];
    const matrix = getScheduleMatrix(
      sources,
      new Date("2026-09-01T01:00:00.000Z"),
      { "lpse-kemenpupr": "2026-08-31T18:00:00.000Z" },
    );

    assert.deepEqual(getNeverCrawledSourceIds(matrix), ["spse-inaproc", "indotender"]);
  });

  it("returns an empty list instead of falling back to a scheduled batch", () => {
    const sources = [makeSource("spse-inaproc")];
    const matrix = getScheduleMatrix(
      sources,
      new Date("2026-09-01T01:00:00.000Z"),
      { "spse-inaproc": "2026-08-31T18:00:00.000Z" },
    );

    assert.deepEqual(getNeverCrawledSourceIds(matrix), []);
  });

  it("includes source metadata required to render every schedule card", () => {
    const source = makeSource("lpse-kemen-bumn");
    const [entry] = getScheduleMatrix([source], new Date("2026-09-01T01:00:00.000Z"));

    assert.equal(entry.sourceUrl, source.url);
    assert.equal(entry.category, source.category);
    assert.equal(entry.description, source.description);
  });
});
