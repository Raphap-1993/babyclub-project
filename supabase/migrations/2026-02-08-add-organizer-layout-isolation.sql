-- Add organizer_id to tables for multi-organizer support
-- Each organizer (Colorimetría, BabyClub, etc) has their own mesas per event

BEGIN;

-- Add organizer_id column to tables
ALTER TABLE IF EXISTS public.tables
ADD COLUMN IF NOT EXISTS organizer_id uuid REFERENCES public.organizers(id);

-- Backfill organizer_id from events relationship
UPDATE public.tables t
SET organizer_id = (
  SELECT e.organizer_id 
  FROM public.events e 
  WHERE e.id = t.event_id
)
WHERE t.organizer_id IS NULL AND t.event_id IS NOT NULL;

-- Create index for fast filtering
CREATE INDEX IF NOT EXISTS idx_tables_organizer_event 
ON public.tables(organizer_id, event_id)
WHERE deleted_at IS NULL;

-- Add soft delete if missing (should exist but double-check)
ALTER TABLE IF EXISTS public.tables
ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

-- Create layout_settings table for per-organizer + per-event layout metadata
CREATE TABLE IF NOT EXISTS public.layout_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES public.organizers(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  layout_url text,
  -- Canvas dimensions for responsive positioning
  canvas_width integer DEFAULT 800,
  canvas_height integer DEFAULT 600,
  scale numeric DEFAULT 1.0,
  notes text,
  created_by_staff_id uuid REFERENCES public.staff(id),
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Unique index: only one layout per org+event
CREATE UNIQUE INDEX IF NOT EXISTS idx_layout_settings_unique 
ON public.layout_settings(organizer_id, event_id);

-- Add comment for clarity
COMMENT ON TABLE public.layout_settings IS 'Per-organizer layout configuration for events. Stores canvas size, scale, and layout image URL.';
COMMENT ON COLUMN public.tables.organizer_id IS 'Owner organizer. Ensures multi-org isolation.';

COMMIT;
