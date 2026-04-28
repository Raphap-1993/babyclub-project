---
id: DEC-0009
type: decision
title: Reportes operativos conservan contrato canonico exportable
status: accepted
date: 2026-04-25
related_req: REQ-0007
adr_required: false
tags:
  - reports
  - promoters
  - no-show
  - sales
---

# DEC-0009 - Reportes operativos conservan contrato canonico exportable

## Contexto

Kevin pidio repetidamente reportes confiables para pagar promotores y controlar no-show de QR free. El repo ya tenia tests que describian ese contrato, pero la ruta actual habia quedado reducida y los tests fallaban.

## Decision

`GET /api/admin/reports/export` mantiene un contrato exportable estable:

- asistencia: escaneos confirmados, admisiones unicas, tipos de QR y horarios Lima;
- promotores: QRs asignados/ingresados y codigos generados como auditoria;
- liquidacion promotores: compras pagadas generan comision aunque no hayan asistido; QR free/cortesia generan comision solo si `tickets.used = true`;
- atribucion de promotores: ticket, reserva y codigo, en ese orden;
- no-show QR free: excluye tickets pagados y marca bloqueo de siguiente QR free;
- ventas: `payments` es fuente principal y reservas confirmadas son fallback cuando `payments` no existe.

## Consecuencias

- Los CSVs vuelven a tener encabezados homologados para operacion.
- La logica queda cubierta por tests de ruta.
- La liquidacion MVP ahora crea ledger manual flexible para marcar pagos/entregas y evitar doble liquidacion.
- Reservas de mesa entran al ledger con monto manual hasta que Kevin cierre una regla fija.

## Verificacion

- `pnpm exec vitest run apps/backoffice/app/api/admin/reports/export/route.test.ts`
