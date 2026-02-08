-- Migration: Add organizer_id to tables with Baby Club data
-- Date: 2026-02-08
-- Context: 6 mesas sin event_id (de Baby Club), 2 eventos (ambos con organizer_id)

BEGIN;

-- Step 1: Add organizer_id column (nullable first)
ALTER TABLE public.tables 
ADD COLUMN organizer_id uuid;

-- Step 2: Get Baby Club organizer ID (04831d27-5b06-48f5-b553-fbb62e04af52)
-- First, fill ALL tables with Baby Club organizer (for those without event_id)
UPDATE public.tables
SET organizer_id = '04831d27-5b06-48f5-b553-fbb62e04af52'
WHERE organizer_id IS NULL;

-- Step 3: For tables WITH event_id, backfill from their events (overwrite if needed)
UPDATE public.tables t
SET organizer_id = e.organizer_id
FROM public.events e
WHERE t.event_id = e.id 
  AND e.organizer_id IS NOT NULL;

-- Step 4: Now make it NOT NULL since we've backfilled everything
ALTER TABLE public.tables
ALTER COLUMN organizer_id SET NOT NULL;

-- Step 5: Add foreign key constraint
ALTER TABLE public.tables
ADD CONSTRAINT tables_organizer_id_fkey 
FOREIGN KEY (organizer_id) REFERENCES public.organizers(id) ON DELETE RESTRICT;

-- Step 6: Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_tables_organizer_event
ON public.tables(organizer_id, event_id)
WHERE deleted_at IS NULL;

-- Step 7: Verify - should return 0 (no NULL organizer_ids)
SELECT COUNT(*) as filas_sin_organizer_id FROM public.tables WHERE organizer_id IS NULL;

-- Step 8: Verify - all 6 mesas should have Baby Club organizer
SELECT 
  t.id,
  t.name,
  t.event_id,
  o.slug
FROM public.tables t
LEFT JOIN public.organizers o ON t.organizer_id = o.id
WHERE t.deleted_at IS NULL;

COMMIT;
