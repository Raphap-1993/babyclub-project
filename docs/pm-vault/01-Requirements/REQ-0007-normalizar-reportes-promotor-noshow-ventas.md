---
id: REQ-0007
type: requirement
title: Normalizar reportes promotor, no-show y ventas
status: done
owner: Vulcan
work_type: bugfix
created: 2026-04-25
updated: 2026-04-25
priority: P0
domain: reports
impacted_apps:
  - apps/backoffice
stakeholders:
  - producto
  - operaciones
  - desarrollo
source_links:
  - /Users/rapha/Downloads/babyacces_recuento_chat_kevin_2026-04-25.md
  - docs/pm-vault/01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md
depends_on:
  - REQ-0003
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/MULTI-EVENT-SYSTEM.md
code_refs:
  - apps/backoffice/app/api/admin/reports/export/route.ts
  - apps/backoffice/app/api/admin/reports/export/route.test.ts
test_refs:
  - pnpm exec vitest run apps/backoffice/app/api/admin/reports/export/route.test.ts
release_target: next
tags:
  - req
  - bugfix
  - reports
  - promoters
  - no-show
---

# REQ-0007 - Normalizar reportes promotor, no-show y ventas

## Problema

El recuento de Kevin marca como P0 que los reportes sirvan para pagar promotores y separar no-show de QR free sin mezclar entradas compradas. Al validar el repo, el test existente de `reports/export` fallaba: faltaban columnas canónicas, `event_sales` no estaba habilitado y el reporte de no-show no exponia bloqueo.

## Objetivo

Restaurar el contrato de reportes operativos para promotores, asistencia, no-show QR free y ventas.

## Resultado esperado

- `promoter_performance` incluye auditoria de codigos generados.
- `event_attendance` expone escaneos confirmados, admisiones unicas, tickets/codigos unicos y breakdown por tipo QR.
- `free_qr_no_show` excluye tickets pagados y marca `block_next_free_qr` cuando corresponde.
- `event_sales` funciona contra `payments` y cae a reservas confirmadas si `payments` no existe en schema cache.
- CSVs mantienen encabezados homologados en español.

## Scope in

- Ajustar `GET /api/admin/reports/export`.
- Mantener fallback legacy de `scan_logs.deleted_at`.
- Reusar tests existentes como contrato de salida.

## Scope out

- Validar cifras contra produccion.
- Crear nuevas pantallas de dashboard.
- Cambiar reglas de negocio de promotores o QR free fuera del reporte.

## Reproduccion actual

- Ejecutar `pnpm exec vitest run apps/backoffice/app/api/admin/reports/export/route.test.ts`.
- Resultado observado: fallaban 8 de 9 tests por columnas faltantes y `event_sales` invalido.

## Reglas de negocio

- Los tickets con `payment_status` no deben contar como QR free no-show.
- No-show QR free se evalua solo sobre eventos pasados.
- Los pagos pagados son fuente principal para ventas; reservas confirmadas son fallback cuando `payments` no existe.

## Impacto en el repo

- Apps o paquetes: `apps/backoffice`
- APIs o contratos: contrato de exportacion admin de reportes
- Datos o migraciones: sin migracion
- Seguridad o permisos: mantiene guard staff existente
- Observabilidad o trazabilidad: los CSVs vuelven a tener encabezados estables

## Gate de arquitectura

- ADR relacionado: no aplica.
- Justificacion: recupera contrato operativo ya esperado por tests; no cambia modelo de datos ni tenancy.

## Criterios de aceptacion

- [x] Reporte promotores conserva `codes_generated`.
- [x] Reporte asistencia conserva columnas canónicas y fallback `scan_logs.deleted_at`.
- [x] Reporte no-show excluye pagos y marca bloqueo.
- [x] Reporte ventas soporta `payments` y fallback de reservas.
- [x] CSVs exportan encabezados homologados.

## Evidencia esperada

- Codigo: `apps/backoffice/app/api/admin/reports/export/route.ts`.
- Tests / checks: `pnpm exec vitest run apps/backoffice/app/api/admin/reports/export/route.test.ts`.
- Docs / changelog: `docs/pm-vault/status.md`, `docs/pm-vault/traceability.md`.

## Riesgos abiertos

- Falta validar manualmente los numeros contra el clon local con data historica real antes de usar el reporte para liquidacion final con Kevin.
