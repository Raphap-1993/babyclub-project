---
id: REQ-0011
type: requirement
title: Liquidaciones flexibles de promotores
status: done
owner: Vulcan
work_type: feature
created: 2026-04-28
updated: 2026-04-28
priority: P0
domain: reports
impacted_apps:
  - apps/backoffice
  - apps/landing
stakeholders:
  - producto
  - operaciones
  - desarrollo
depends_on:
  - REQ-0007
related_adrs: []
adr_not_required: true
code_refs:
  - apps/backoffice/app/admin/reportes/components/ReportWorkspace.tsx
  - apps/backoffice/app/api/admin/promoter-settlements/route.ts
  - apps/backoffice/app/api/admin/promoter-settlements/[id]/route.ts
  - apps/backoffice/app/api/admin/reports/export/route.ts
  - apps/landing/app/registro/page.tsx
  - apps/landing/app/compra/page.tsx
  - apps/landing/app/api/reservations/route.ts
  - apps/landing/app/api/ticket-reservations/route.ts
  - apps/landing/app/api/codes/info/route.ts
  - apps/backoffice/app/admin/liquidaciones/page.tsx
  - apps/backoffice/app/admin/reportes/liquidaciones/page.tsx
  - supabase/migrations/20260428112000_add_ticket_reservation_attendees.sql
  - supabase/migrations/20260428112100_add_promoter_link_trace_to_reservations.sql
  - supabase/migrations/20260428112200_promoter_settlements_ledger.sql
test_refs:
  - pnpm exec vitest run apps/backoffice/app/api/admin/reports/export/route.test.ts apps/backoffice/app/api/admin/promoter-settlements/route.test.ts apps/landing/app/api/ticket-reservations/route.test.ts apps/landing/app/api/reservations/route.test.ts apps/landing/app/api/codes/info/route.test.ts
  - pnpm typecheck:backoffice
  - pnpm typecheck:landing
release_target: next
tags:
  - req
  - feature
  - reports
  - promoters
  - settlements
---

# REQ-0011 - Liquidaciones flexibles de promotores

## Problema

El reporte `promoter_settlement` muestra elegibles, pero operaciones necesita registrar el acto de liquidar: cuanto se paga, que items entran, quien lo marco y evitar pagar dos veces el mismo ticket o reserva.

## Objetivo

Crear un MVP de ledger manual y flexible para que el admin pueda liquidar promotores desde un CRUD separado en backoffice sin integrar pagos automaticos, manteniendo reportes como lectura consolidada.

## Reglas de negocio

- Early Baby individual genera S/ 3.00 de comision.
- Early Baby duo genera S/ 5.00 de comision.
- All Night individual genera S/ 3.50 de comision.
- All Night duo genera S/ 6.00 de comision.
- La compra de entradas genera comision aunque el comprador no haya asistido.
- QR free/cortesia/promoter link genera S/ 1.50 solo si fue leido/ingreso a la fiesta.
- La reserva de mesa genera comision para el promotor, pero el monto queda manual/configurable en este MVP.
- Un ticket o reserva no puede quedar en dos liquidaciones activas.
- Si la compra de entrada o reserva de mesa nace desde link de promotor, se guarda snapshot de `promoter_link_code_id` y `promoter_link_code` en `table_reservations` para auditoria.
- Los tragos quedan ocultos del modal y del CSV operativo en este MVP; el ledger conserva campos tecnicos legacy, pero no se ofrecen como accion al admin.

## Scope in

- Crear tablas `promoter_settlements` y `promoter_settlement_items`.
- Exponer API admin para listar, crear y cambiar estado de liquidaciones.
- Crear pagina `/admin/liquidaciones` con grilla, busqueda de promotor, calculo de pendientes y modal de nueva liquidacion.
- Crear reporte consolidado `/admin/reportes/liquidaciones` para leer totales e historial sin mezclar CRUD con reportes.
- Marcar liquidaciones como `paid` o `void`.
- Anular liquidaciones con doble confirmacion.
- Excluir items ya liquidados del reporte pendiente.
- Propagar links de promotor desde `/registro?code=...` hacia `/compra` y guardarlos en compras de entradas/reservas de mesa.
- Homologar CSV descargable con la vista operativa agregando `Links usados` y sin exponer tragos.

## Scope out

- Pagos automaticos, transferencias o billeteras.
- Ledger contable completo.
- Reglas definitivas de comision por mesa.
- Auditoria financiera avanzada.

## Criterios de aceptacion

- [x] Reporte de promotores mantiene lectura operativa sin CRUD embebido.
- [x] Admin puede crear liquidacion desde CRUD separado.
- [x] El total efectivo es editable antes de guardar.
- [x] La liquidacion guarda cabecera, items, estado, staff y metadata.
- [x] La API bloquea doble liquidacion de ticket/reserva.
- [x] Las compras pagadas suman comision aunque `used=false`.
- [x] QR free suma S/ 1.50 solo si `used=true`.
- [x] Reservas de mesa aparecen como item liquidable manual.
- [x] Tabla principal de liquidacion muestra solo columnas operativas; el detalle queda en modal/export.
- [x] Modal de liquidacion no muestra campo ni columna de tragos.
- [x] CSV de liquidacion queda homologado con columnas operativas y trazabilidad `Links usados`.
- [x] Compras/reservas hechas desde link de promotor guardan `promoter_id`, `promoter_link_code_id` y `promoter_link_code`.
- [x] Generated table codes heredan `promoter_id` cuando la reserva de mesa viene por link/promotor.
- [x] Acciones de grilla usan iconos y la anulacion pide doble confirmacion.
- [x] Reporte consolidado de liquidaciones queda separado del CRUD.

## Evidencia

- Tests: `pnpm exec vitest run apps/backoffice/app/api/admin/reports/export/route.test.ts apps/backoffice/app/api/admin/promoter-settlements/route.test.ts apps/landing/app/api/ticket-reservations/route.test.ts apps/landing/app/api/reservations/route.test.ts apps/landing/app/api/codes/info/route.test.ts`.
- Typecheck: `pnpm typecheck:backoffice`, `pnpm typecheck:landing`.
- DB remoto: `supabase db push --linked --yes`.
- Verificacion remota: metadata confirma `table_reservations.attendees`, `promoter_link_code_id`, `promoter_link_code`, `promoter_settlements` y `promoter_settlement_items`.

## Pendiente operativo

- Confirmar monto/regla de comision para reservas de mesa.
- Smoke visual en backoffice con evento/promotor real.
- Smoke E2E desde un link de promotor: comprar entrada, reservar mesa y revisar que el reporte muestre el link usado.
