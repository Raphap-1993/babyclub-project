-- ========================================
-- MANUAL MIGRATION SCRIPT
-- Files: 2026-02-09-add-codes-reservation-tracking.sql
--        2026-02-09-add-event-prefix.sql
-- ========================================
-- Instructions:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"
-- ========================================

BEGIN;

-- ========================================
-- PART 1: Add reservation tracking to codes
-- ========================================

-- Add foreign key to table_reservations
ALTER TABLE public.codes 
  ADD COLUMN IF NOT EXISTS table_reservation_id uuid REFERENCES public.table_reservations(id) ON DELETE CASCADE;

-- Add person index (1-5 depending on table capacity)
-- This tracks which person in the reservation this code belongs to
ALTER TABLE public.codes 
  ADD COLUMN IF NOT EXISTS person_index integer CHECK (person_index >= 1 AND person_index <= 10);

-- Add index for efficient querying of codes by reservation
CREATE INDEX IF NOT EXISTS codes_table_reservation_idx 
  ON public.codes(table_reservation_id) 
  WHERE table_reservation_id IS NOT NULL;

-- Add compound index for reservation + person lookup
CREATE INDEX IF NOT EXISTS codes_reservation_person_idx 
  ON public.codes(table_reservation_id, person_index) 
  WHERE table_reservation_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.codes.table_reservation_id IS 
  'Links code to a table reservation. Used for individual QR codes per person in mesa reservations.';

COMMENT ON COLUMN public.codes.person_index IS 
  'Position index (1-N) of the person within the reservation. Used to generate friendly codes like BC-LOVE-M1-001.';

-- ========================================
-- PART 2: Add event_prefix for friendly codes
-- ========================================

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS event_prefix text;

-- Set default prefixes based on existing event names
UPDATE public.events 
SET event_prefix = UPPER(SUBSTRING(REPLACE(name, ' ', ''), 1, 5))
WHERE event_prefix IS NULL;

-- Add comment
COMMENT ON COLUMN public.events.event_prefix IS 
  'Short uppercase prefix used in friendly codes (e.g., LOVE, FIESTA, NEON). Max 10 chars.';

-- Add constraint to ensure reasonable length (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'events_prefix_length'
  ) THEN
    ALTER TABLE public.events 
      ADD CONSTRAINT events_prefix_length 
      CHECK (event_prefix IS NULL OR (LENGTH(event_prefix) >= 2 AND LENGTH(event_prefix) <= 10));
  END IF;
END $$;

COMMIT;

-- ========================================
-- VERIFICATION QUERIES (run after migration)
-- ========================================
-- SELECT 
--   column_name, 
--   data_type, 
--   is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'codes' 
--   AND column_name IN ('table_reservation_id', 'person_index')
-- ORDER BY column_name;
--
-- SELECT 
--   id,
--   name,
--   event_prefix
-- FROM public.events
-- LIMIT 5;

