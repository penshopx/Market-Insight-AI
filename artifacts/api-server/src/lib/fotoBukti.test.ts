/**
 * Tests: foto-bukti data integrity
 *
 * 1. Unit tests for isPhotoUrl() and extractFotoBuktiUrl() helper logic.
 *    These helpers live in the mobile SearchCards component; their pure-function
 *    logic is reproduced here so the tests run without React Native.
 *
 * 2. Integration (DB round-trip) tests that verify:
 *    - sourceUrl on research-items survives INSERT → SELECT unchanged.
 *    - [Foto bukti: <url>] inside contractor notes survives INSERT → SELECT unchanged.
 *
 * Run: pnpm --filter @workspace/api-server test
 */

import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { pool } from "@workspace/db";
// Import the real production helpers from the mobile utils module.
// fotoBuktiHelpers.ts has no React Native imports so it runs cleanly in Node.js.
import {
  isPhotoUrl,
  extractFotoBuktiUrl,
} from "@workspace/photo-helpers";

// ─── Unit tests: isPhotoUrl ──────────────────────────────────────────────────

describe("isPhotoUrl", () => {
  it("returns true for a base64 data URL", () => {
    assert.ok(isPhotoUrl("data:image/jpeg;base64,/9j/4AAQSkZJRgAB"));
  });

  it("returns true for a .jpg URL", () => {
    assert.ok(isPhotoUrl("https://example.com/photos/proof.jpg"));
  });

  it("returns true for a .png URL", () => {
    assert.ok(isPhotoUrl("https://cdn.example.com/uploads/abc123.png"));
  });

  it("returns true for a .webp URL with query string", () => {
    assert.ok(isPhotoUrl("https://example.com/img.webp?v=2"));
  });

  it("returns true for a storage-path URL without extension", () => {
    assert.ok(isPhotoUrl("https://api.example.com/storage/abc-uuid-def"));
  });

  it("returns true for an /objects/ path URL", () => {
    assert.ok(isPhotoUrl("https://api.example.com/objects/photo-123"));
  });

  it("returns false for null", () => {
    assert.ok(!isPhotoUrl(null));
  });

  it("returns false for undefined", () => {
    assert.ok(!isPhotoUrl(undefined));
  });

  it("returns false for empty string", () => {
    assert.ok(!isPhotoUrl(""));
  });

  it("returns false for a plain text string", () => {
    assert.ok(!isPhotoUrl("catatan biasa tanpa foto"));
  });

  it("returns false for a non-image URL (e.g. PDF)", () => {
    assert.ok(!isPhotoUrl("https://example.com/doc.pdf"));
  });

  it("returns false for a URL with no path clues", () => {
    assert.ok(!isPhotoUrl("https://example.com/api/data"));
  });
});

// ─── Unit tests: extractFotoBuktiUrl ────────────────────────────────────────

describe("extractFotoBuktiUrl", () => {
  it("extracts an https URL from the [Foto bukti: ...] tag", () => {
    const notes = "Catatan kunjungan.\n[Foto bukti: https://cdn.example.com/proof.jpg]\nSelesai.";
    assert.equal(extractFotoBuktiUrl(notes), "https://cdn.example.com/proof.jpg");
  });

  it("extracts a base64 data URL from the [Foto bukti: ...] tag", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgo=";
    const notes = `[Foto bukti: ${dataUrl}]`;
    assert.equal(extractFotoBuktiUrl(notes), dataUrl);
  });

  it("is case-insensitive for the tag keyword", () => {
    const notes = "[foto bukti: https://example.com/img.jpg]";
    assert.equal(extractFotoBuktiUrl(notes), "https://example.com/img.jpg");
  });

  it("trims whitespace around the URL", () => {
    const notes = "[Foto bukti:   https://example.com/img.jpg  ]";
    // The regex does not trim trailing space inside the bracket; trim() call is on match[1]
    // So the result should not have leading/trailing whitespace
    const result = extractFotoBuktiUrl(notes);
    assert.ok(result !== null && !result.startsWith(" ") && !result.endsWith(" "));
  });

  it("returns null when no [Foto bukti: ...] tag present", () => {
    assert.equal(extractFotoBuktiUrl("catatan biasa tanpa foto"), null);
  });

  it("returns null for null input", () => {
    assert.equal(extractFotoBuktiUrl(null), null);
  });

  it("returns null for undefined input", () => {
    assert.equal(extractFotoBuktiUrl(undefined), null);
  });

  it("returns null for empty string", () => {
    assert.equal(extractFotoBuktiUrl(""), null);
  });

  it("returns null when tag contains a non-URL value", () => {
    // ftp:// and relative paths are not matched
    assert.equal(extractFotoBuktiUrl("[Foto bukti: /relative/path.jpg]"), null);
  });
});

// ─── Integration: research-items sourceUrl round-trip ───────────────────────

const insertedResearchIds: number[] = [];
const insertedContractorIds: number[] = [];

after(async () => {
  // Safety-net cleanup
  if (insertedResearchIds.length) {
    await pool.query(
      `DELETE FROM research_items WHERE id = ANY($1::int[])`,
      [insertedResearchIds],
    );
  }
  if (insertedContractorIds.length) {
    await pool.query(
      `DELETE FROM contractors WHERE id = ANY($1::int[])`,
      [insertedContractorIds],
    );
  }
  await pool.end();
});

describe("research-items sourceUrl round-trip", () => {
  it("stores and returns a plain https sourceUrl unchanged", async () => {
    const url = "https://example.com/tender/info?id=42&ref=test";
    const { rows } = await pool.query<{ id: number; source_url: string | null }>(
      `INSERT INTO research_items (title, category, status, source, source_url)
       VALUES ('Test riset foto bukti', 'TENDER_OPPORTUNITY', 'PENDING', 'TEST', $1)
       RETURNING id, source_url`,
      [url],
    );
    const row = rows[0]!;
    insertedResearchIds.push(row.id);

    // Verify round-trip
    const { rows: fetched } = await pool.query<{ source_url: string | null }>(
      `SELECT source_url FROM research_items WHERE id = $1`,
      [row.id],
    );
    assert.equal(fetched[0]!.source_url, url, "sourceUrl should be stored and returned intact");

    // Cleanup
    await pool.query(`DELETE FROM research_items WHERE id = $1`, [row.id]);
    insertedResearchIds.pop();
  });

  it("stores and returns a long base64-like data URL as sourceUrl without truncation", async () => {
    // Simulate the kind of long URL that could be truncated if column type is too small
    const longUrl = "https://storage.example.com/" + "a".repeat(300) + "/proof.jpg";
    const { rows } = await pool.query<{ id: number; source_url: string | null }>(
      `INSERT INTO research_items (title, category, status, source, source_url)
       VALUES ('Test riset long url', 'TENDER_OPPORTUNITY', 'PENDING', 'TEST', $1)
       RETURNING id, source_url`,
      [longUrl],
    );
    const row = rows[0]!;
    insertedResearchIds.push(row.id);

    const { rows: fetched } = await pool.query<{ source_url: string | null }>(
      `SELECT source_url FROM research_items WHERE id = $1`,
      [row.id],
    );
    assert.equal(
      fetched[0]!.source_url,
      longUrl,
      "A long sourceUrl should not be truncated by the database",
    );
    assert.equal(fetched[0]!.source_url?.length, longUrl.length);

    await pool.query(`DELETE FROM research_items WHERE id = $1`, [row.id]);
    insertedResearchIds.pop();
  });
});

// ─── Integration: contractors notes [Foto bukti:] round-trip ────────────────

describe("contractors notes [Foto bukti:] round-trip", () => {
  it("stores and returns notes with [Foto bukti: https://...] tag unchanged", async () => {
    const photoUrl = "https://cdn.example.com/contractor-evidence/abc123.jpg";
    const notes = `Kunjungan lapangan berhasil.\n[Foto bukti: ${photoUrl}]\nTerima kasih.`;

    const { rows } = await pool.query<{ id: number; notes: string | null }>(
      `INSERT INTO contractors (name, type, sbu_level, notes)
       VALUES ('PT Test Foto Bukti', 'KONTRAKTOR', 'M', $1)
       RETURNING id, notes`,
      [notes],
    );
    const row = rows[0]!;
    insertedContractorIds.push(row.id);

    const { rows: fetched } = await pool.query<{ notes: string | null }>(
      `SELECT notes FROM contractors WHERE id = $1`,
      [row.id],
    );
    assert.equal(fetched[0]!.notes, notes, "notes field should be stored and returned intact");

    // Verify the photo URL can be re-extracted from the stored notes
    const extracted = extractFotoBuktiUrl(fetched[0]!.notes);
    assert.equal(extracted, photoUrl, "extractFotoBuktiUrl should recover original URL from stored notes");

    await pool.query(`DELETE FROM contractors WHERE id = $1`, [row.id]);
    insertedContractorIds.pop();
  });

  it("stores and returns notes with a base64 data URL in [Foto bukti:] tag without corruption", async () => {
    // Use a realistic small base64 payload (1×1 red pixel PNG)
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
    const notes = `[Foto bukti: ${dataUrl}]`;

    const { rows } = await pool.query<{ id: number; notes: string | null }>(
      `INSERT INTO contractors (name, type, sbu_level, notes)
       VALUES ('PT Test Foto Base64', 'KONTRAKTOR', 'K', $1)
       RETURNING id, notes`,
      [notes],
    );
    const row = rows[0]!;
    insertedContractorIds.push(row.id);

    const { rows: fetched } = await pool.query<{ notes: string | null }>(
      `SELECT notes FROM contractors WHERE id = $1`,
      [row.id],
    );

    // The notes field must be bit-for-bit identical
    assert.equal(
      fetched[0]!.notes,
      notes,
      "notes with base64 data URL should survive DB round-trip without corruption",
    );

    // extractFotoBuktiUrl must recover the full data URL
    const extracted = extractFotoBuktiUrl(fetched[0]!.notes);
    assert.equal(extracted, dataUrl, "Full base64 data URL should be recoverable after DB round-trip");

    await pool.query(`DELETE FROM contractors WHERE id = $1`, [row.id]);
    insertedContractorIds.pop();
  });
});
