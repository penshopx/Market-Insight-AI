/**
 * Server-controlled orphan upload cleanup.
 *
 * After a successful upload to GCS, if the associated DB record fails to save
 * (e.g. network error, server crash before the create call completes), the
 * GCS object becomes an orphan — it exists in storage but is not referenced
 * by any DB row.
 *
 * This module provides `cleanupOrphanUploads()` which:
 *   1. Lists all GCS objects under the uploads/ prefix.
 *   2. Queries the DB for all photo URLs stored in `pain_points.evidence_photo_url`.
 *   3. Deletes GCS objects that are older than ORPHAN_AGE_HOURS and not
 *      referenced by any DB row.
 *
 * It is called on server startup (to handle crashes during the previous
 * session) and on a recurring 1-hour interval.
 */

import { isNotNull, or } from "drizzle-orm";
import { db, painPointsTable, researchItemsTable, contractorsTable } from "@workspace/db";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const objectStorageService = new ObjectStorageService();

/** Objects newer than this are left alone to allow in-flight submits to complete. */
const ORPHAN_AGE_HOURS = 2;
const ORPHAN_AGE_MS = ORPHAN_AGE_HOURS * 60 * 60 * 1000;

/**
 * Extract the `/objects/uploads/<uuid>` path from a full serving URL.
 * Serving URL format: https://HOST/api/storage/objects/uploads/<uuid>
 */
function servingUrlToObjectPath(url: string): string | null {
  const match = /\/objects\/uploads\/[^/?#]+/.exec(url);
  return match ? match[0] : null;
}

export async function cleanupOrphanUploads(): Promise<void> {
  // Step 1: list all GCS uploads.
  let uploads: Array<{ objectPath: string; createdAt: Date }>;
  try {
    uploads = await objectStorageService.listUploadedObjects();
  } catch (err) {
    logger.error({ err }, "cleanupOrphanUploads: failed to list uploaded objects — skipping");
    return;
  }

  // Only examine objects old enough that any in-flight client submits have settled.
  const cutoff = new Date(Date.now() - ORPHAN_AGE_MS);
  const oldUploads = uploads.filter((u) => u.createdAt < cutoff);

  if (oldUploads.length === 0) {
    logger.debug("cleanupOrphanUploads: no uploads older than %d hours — nothing to do", ORPHAN_AGE_HOURS);
    return;
  }

  // Step 2: collect all object paths referenced by the DB across all three form types.
  //
  // - pain_points.evidence_photo_url  — dedicated column, direct URL
  // - research_items.source_url       — photos uploaded from the riset form are stored here
  // - contractors.notes               — photos are embedded as "[Foto bukti: <url>]" text
  //
  // Any GCS upload URL found in any of these columns is treated as referenced and
  // will NOT be deleted, regardless of age.
  let referencedPaths: Set<string>;
  try {
    const [painPointRows, researchRows, contractorRows] = await Promise.all([
      db
        .select({ url: painPointsTable.evidencePhotoUrl })
        .from(painPointsTable)
        .where(isNotNull(painPointsTable.evidencePhotoUrl)),

      db
        .select({ url: researchItemsTable.sourceUrl })
        .from(researchItemsTable)
        .where(isNotNull(researchItemsTable.sourceUrl)),

      db
        .select({ url: contractorsTable.notes })
        .from(contractorsTable)
        .where(isNotNull(contractorsTable.notes)),
    ]);

    const allUrls: string[] = [
      ...painPointRows.map((r) => r.url!),
      ...researchRows.map((r) => r.url!),
      // Contractor notes may contain multiple embedded URLs — extract all of them.
      ...contractorRows.flatMap((r) => {
        const matches = r.url!.match(/\/objects\/uploads\/[^/?#\s\]]+/g);
        return matches ?? [];
      }),
    ];

    referencedPaths = new Set(
      allUrls
        .map((url) => servingUrlToObjectPath(url))
        .filter((p): p is string => p !== null),
    );
  } catch (err) {
    logger.error({ err }, "cleanupOrphanUploads: failed to query DB for referenced URLs — skipping");
    return;
  }

  // Step 3: delete any old upload not referenced in the DB.
  let deleted = 0;
  let failed = 0;
  for (const upload of oldUploads) {
    if (referencedPaths.has(upload.objectPath)) {
      continue; // still referenced — leave it alone
    }
    try {
      await objectStorageService.deleteObjectByPath(upload.objectPath);
      deleted++;
      logger.info({ objectPath: upload.objectPath }, "cleanupOrphanUploads: deleted orphan");
    } catch (err) {
      failed++;
      logger.error({ err, objectPath: upload.objectPath }, "cleanupOrphanUploads: failed to delete orphan");
    }
  }

  if (deleted + failed > 0) {
    logger.info(
      { deleted, failed, checked: oldUploads.length },
      "cleanupOrphanUploads: run complete",
    );
  } else {
    logger.debug(
      { checked: oldUploads.length },
      "cleanupOrphanUploads: no orphans found",
    );
  }
}

/** Schedule recurring cleanup and run once immediately on startup. */
export function startOrphanCleanupSchedule(): void {
  const INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  // Run immediately so orphans from before the last server restart are handled.
  cleanupOrphanUploads().catch((err) =>
    logger.error({ err }, "cleanupOrphanUploads: startup run failed"),
  );

  setInterval(() => {
    cleanupOrphanUploads().catch((err) =>
      logger.error({ err }, "cleanupOrphanUploads: scheduled run failed"),
    );
  }, INTERVAL_MS);
}
