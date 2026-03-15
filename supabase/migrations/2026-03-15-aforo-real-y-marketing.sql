-- Fase A: Aforo real del evento
-- Función que cuenta TODOS los tickets activos de un evento,
-- independientemente del código, reserva o cortesía que los generó.
CREATE OR REPLACE FUNCTION public.count_event_tickets(p_event_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.tickets
  WHERE event_id = p_event_id
    AND deleted_at IS NULL
    AND is_active = true;
$$;

-- Fase B: Capacidad de marketing (visual) separada del aforo real
-- Si es NULL, la barra del landing usa la capacidad real del evento.
-- Si está seteada, la barra usa este número para generar urgencia visual.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS marketing_capacity integer NULL;

COMMENT ON COLUMN public.events.marketing_capacity IS
  'Capacidad visual para la barra de progreso del landing. '
  'Si es NULL, usa capacity real. '
  'No afecta el bloqueo de tickets — ese sigue usando events.capacity.';
