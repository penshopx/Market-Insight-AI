#!/bin/bash
set -e
pnpm install --no-frozen-lockfile

# Remove duplicate research_items rows before creating the unique index.
# Only targets rows where ALL three index columns are non-NULL (matching
# PostgreSQL's unique-index semantics, which treats NULLs as always distinct).
# Keeps the row with the lowest id per (data_source_site, title, collected_at).
psql "$DATABASE_URL" -c "
  DELETE FROM research_items
  WHERE data_source_site IS NOT NULL
    AND title IS NOT NULL
    AND collected_at IS NOT NULL
    AND id NOT IN (
      SELECT MIN(id)
      FROM research_items
      WHERE data_source_site IS NOT NULL
        AND title IS NOT NULL
        AND collected_at IS NOT NULL
      GROUP BY data_source_site, title, collected_at
    );
" || true   # non-fatal: table may not exist yet on first deploy

# Remove duplicate workroom_notes rows before creating the unique index on
# (entity_type, entity_id). Keeps the most recently updated row per pair.
# Non-fatal: table may not exist yet on first deploy.
psql "$DATABASE_URL" -c "
  DELETE FROM workroom_notes
  WHERE id NOT IN (
    SELECT DISTINCT ON (entity_type, entity_id) id
    FROM workroom_notes
    ORDER BY entity_type, entity_id, updated_at DESC, id DESC
  );
" || true

pnpm --filter @workspace/db run push-force
