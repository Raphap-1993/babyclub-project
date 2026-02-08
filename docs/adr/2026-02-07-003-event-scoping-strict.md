# ADR 003: Event Scoping Estricto en Flujos Publicos

Fecha: 2026-02-07  
Estado: Aprobado

## Contexto
- El negocio requiere soportar multiples eventos en el mismo mes.
- Existia un fallback en reservas que, si no encontraba `event_id`, asignaba el primer evento activo.
- Ese comportamiento puede mezclar reservas/codigos entre eventos y romper reportes/auditoria.

## Decision
- `POST /api/reservations` deja de usar fallback global de evento.
- El `event_id` se resuelve solo por fuentes validas: `table.event_id`, `body.event_id`, `code.event_id`.
- Si hay conflicto entre fuentes, se rechaza con `400`.
- Si no se puede resolver `event_id`, se rechaza con `400`.
- `GET /api/tables` acepta `event_id` para devolver solo mesas del evento seleccionado.
- UI publica (`registro` y `compra`) consume mesas filtradas por evento.

## Consecuencias
- Se reduce el riesgo de contaminar data historica entre eventos.
- El sistema queda preparado para selector de eventos en escenarios multi-evento.
- Cambian algunos errores de runtime: ahora hay errores explicitos de configuracion en lugar de fallback silencioso.

## Rollback
- Revertir cambios en:
  - `apps/landing/app/api/reservations/route.ts`
  - `apps/landing/app/api/tables/route.ts`
  - `apps/landing/app/registro/page.tsx`
  - `apps/landing/app/compra/page.tsx`
- Restaurar comportamiento anterior solo como medida temporal.

