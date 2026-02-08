-- Migration: Add organizer_id to tables (multi-organizer scoping)
-- Purpose: Enforce organization isolation at table level
-- Rollback: Fully reversible via DROP COLUMN if needed

BEGIN;

-- Step 1: Add organizer_id column (if not exists)
DO $$
BEGIN
  ALTER TABLE public.tables 
  ADD COLUMN organizer_id uuid;
EXCEPTION
  WHEN duplicate_column THEN
    -- Column already exists, safe to continue
    NULL;
END
$$;

-- Step 2: Backfill organizer_id from events relationship
-- Only update rows where organizer_id is NULL (safety check)
UPDATE public.tables t
SET organizer_id = e.organizer_id
FROM public.events e
WHERE t.event_id = e.id 
  AND t.organizer_id IS NULL
  AND e.organizer_id IS NOT NULL;

-- Step 3: Add NOT NULL constraint after backfill
-- (assuming all events have organizer_id; if some don't, use DEFAULT logic)
ALTER TABLE public.tables
ALTER COLUMN organizer_id SET NOT NULL;

-- Step 4: Add foreign key constraint (if not exists)
DO $$
BEGIN
  ALTER TABLE public.tables
  ADD CONSTRAINT tables_organizer_id_fkey 
  FOREIGN KEY (organizer_id) REFERENCES public.organizers(id);
EXCEPTION
  WHEN duplicate_object THEN
    -- Constraint already exists, safe to continue
    NULL;
END
$$;

-- Step 5: Create index for fast filtering by organizer + event
CREATE INDEX IF NOT EXISTS idx_tables_organizer_event
ON public.tables(organizer_id, event_id)
WHERE deleted_at IS NULL;

-- Step 6: Verify consistency (optional, helps debugging)
-- Tables should have organizer_id matching their event's organizer_id
DO $$
DECLARE
  mismatch_count INT;
BEGIN
  SELECT COUNT(*) INTO mismatch_count
  FROM public.tables t
  LEFT JOIN public.events e ON t.event_id = e.id
  WHERE t.organizer_id IS DISTINCT FROM e.organizer_id
    AND t.deleted_at IS NULL;
  
  IF mismatch_count > 0 THEN
    RAISE WARNING 'Found % tables with mismatched organizer_id vs events.organizer_id', mismatch_count;
  END IF;
END
$$;

COMMIT;
