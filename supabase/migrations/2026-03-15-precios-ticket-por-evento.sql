-- Precios de tickets configurables por evento
-- Reemplaza los valores hardcodeados en el código del landing
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS early_bird_price_1 NUMERIC(10,2) DEFAULT 15,
  ADD COLUMN IF NOT EXISTS early_bird_price_2 NUMERIC(10,2) DEFAULT 25,
  ADD COLUMN IF NOT EXISTS all_night_price_1  NUMERIC(10,2) DEFAULT 20,
  ADD COLUMN IF NOT EXISTS all_night_price_2  NUMERIC(10,2) DEFAULT 35,
  ADD COLUMN IF NOT EXISTS early_bird_enabled BOOLEAN       DEFAULT false;

COMMENT ON COLUMN public.events.early_bird_price_1 IS 'Precio EARLY BABY individual (1 ticket). Fallback: 15.';
COMMENT ON COLUMN public.events.early_bird_price_2 IS 'Precio EARLY BABY pareja (2 tickets). Fallback: 25.';
COMMENT ON COLUMN public.events.all_night_price_1  IS 'Precio ALL NIGHT individual (1 ticket). Fallback: 20.';
COMMENT ON COLUMN public.events.all_night_price_2  IS 'Precio ALL NIGHT pareja (2 tickets). Fallback: 35.';
COMMENT ON COLUMN public.events.early_bird_enabled IS 'Muestra y habilita la opción EARLY BABY en el landing. Si false, solo se ofrece ALL NIGHT.';
