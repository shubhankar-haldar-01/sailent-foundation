-- Enforce uniqueness for program title (case-insensitive, trimmed, excluding soft-deleted)
CREATE UNIQUE INDEX IF NOT EXISTS "programs_title_unique"
ON "programs" (lower(btrim("title")))
WHERE "deleted_at" IS NULL;

