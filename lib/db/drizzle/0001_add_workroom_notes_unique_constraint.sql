-- Step 1: Remove duplicate (entity_type, entity_id) rows that may exist from the former
-- select-then-insert implementation, keeping the most recently updated row per pair.
DELETE FROM "workroom_notes"
WHERE "id" NOT IN (
  SELECT DISTINCT ON ("entity_type", "entity_id") "id"
  FROM "workroom_notes"
  ORDER BY "entity_type", "entity_id", "updated_at" DESC, "id" DESC
);

-- Step 2: Add unique constraint only if not already present (idempotent).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'workroom_notes'
      AND constraint_name = 'workroom_notes_entity_type_entity_id_unique'
  ) THEN
    ALTER TABLE "workroom_notes"
      ADD CONSTRAINT "workroom_notes_entity_type_entity_id_unique"
      UNIQUE("entity_type","entity_id");
  END IF;
END $$;
