-- Add event_prefix column for friendly code generation
-- This is used to create codes like: BC-LOVE-M1-001, BC-FIESTA-M2-003

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS event_prefix text;

-- Set default prefixes based on existing event names
UPDATE public.events 
SET event_prefix = UPPER(SUBSTRING(REPLACE(name, ' ', ''), 1, 5))
WHERE event_prefix IS NULL;

-- Add comment
COMMENT ON COLUMN public.events.event_prefix IS 
  'Short uppercase prefix used in friendly codes (e.g., LOVE, FIESTA, NEON). Max 10 chars.';

-- Add constraint to ensure reasonable length
ALTER TABLE public.events 
  ADD CONSTRAINT events_prefix_length 
  CHECK (event_prefix IS NULL OR (LENGTH(event_prefix) >= 2 AND LENGTH(event_prefix) <= 10));
