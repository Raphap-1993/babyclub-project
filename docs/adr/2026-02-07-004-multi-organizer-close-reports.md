# ADR 004: Multi-Organizador + Cierre de Evento + Reportes Backend

Fecha: 2026-02-07  
Estado: Aprobado

## Contexto
- El producto debe operar eventos de Baby y de aliados en la misma plataforma.
- Se requiere cerrar eventos sin perder trazabilidad histórica.
- Reportes críticos deben vivir en backend para evitar lógica duplicada en frontend.

## Decisiones
1. Se introduce entidad `organizers` y `organizer_id` como dimensión organizativa base.
2. Eventos se crean/editan con organizador explícito desde backoffice.
3. Se añade cierre operativo de evento vía API:
   - desactiva códigos activos,
   - marca evento inactivo,
   - guarda `closed_at`, `closed_by`, `close_reason`,
   - registra auditoría en `process_logs`.
4. Se habilita motor backend de reportes/export:
   - `promoter_performance`,
   - `event_attendance`,
   - `event_sales`,
   con filtros por `organizer_id`, `event_id`, `promoter_id`, rango de fechas y salida `json/csv`.

## Consecuencias
- Se habilita operación multi-organizador sin subdominios.
- Cierre de evento deja evidencia auditable y evita mezcla operativa.
- Reportes pasan a backend-first, listos para consumo web y futura exportación Excel.

## Rollback
- Revertir migración `2026-02-07-add-organizers-and-event-close.sql` (solo si no hay datos nuevos dependientes).
- Deshabilitar uso de rutas nuevas:
  - `/api/events/close`
  - `/api/admin/reports/export`
- Mantener histórico existente sin borrado físico.

