## ADR-009 - Unidades individuales por paquete y nominacion posterior

**Fecha:** 2026-05-27
**Estado:** Aprobado

## Contexto

REQ-0012 introduce compra publica por paquetes (`package_quantity`) y exige separar la cabecera comercial de la unidad individual que luego se nomina, emite y usa en puerta. Hoy `table_reservations` ya guarda snapshot comercial y `attendees` legacy para compras ticket-only, pero ese JSON no define una unidad canonica con lifecycle propio por QR.

## Decision

Mantener `public.table_reservations` como cabecera de compra y agregar dos extensiones:

- `package_quantity`: cantidad de paquetes comprados.
- `total_ticket_units`: total historico de unidades individuales derivadas de `ticket_quantity * package_quantity`.

Crear `public.ticket_reservation_units` como tabla unitaria por asistente/QR derivado de la reserva. Cada fila representa una unidad individual y nace en estado `pending_nomination`.

Estados canonicos de la unidad:

- `pending_nomination`
- `nominated`
- `issued`
- `used`
- `cancelled`

La nominacion es el gate obligatorio para emitir y usar el QR:

- no se debe emitir QR usable mientras la unidad siga en `pending_nomination`;
- `issued` y `used` solo aplican a unidades ya nominadas;
- el scanner debe tratar la falta de nominacion como bloqueo funcional, no como warning cosmetico.

`table_reservations.attendees` sigue coexistiendo como compatibilidad transitoria para flujos y data legacy. No se elimina ni redefine en esta iteracion; la nueva fuente de verdad para lifecycle unitario pasa a ser `ticket_reservation_units`.

## Consecuencias

- La compra por paquetes queda modelada sin romper la cabecera actual de reservas.
- Correo, QR y scanner pueden migrar hacia una unidad individual controlable por estado.
- `attendees` deja de ser candidato a fuente canonica de lifecycle, pero se mantiene para no romper historicos ni entornos atrasados.
- La emision/uso real de QR queda desacoplada del momento de pago y ligada a nominacion valida.

## Implementacion

- Requerimiento relacionado: `REQ-0012`
- Areas impactadas: `packages/shared`, `supabase/migrations`, flujos futuros de landing/backoffice/scanner
- Migraciones o contratos afectados:
  - `table_reservations.package_quantity`
  - `table_reservations.total_ticket_units`
  - `ticket_reservation_units`

## Validacion

- Helper compartido para construir unidades individuales por `package_quantity * unitsPerPackage`
- Test aislado de `packages/shared/ticketReservationUnits.test.ts`
- Revision de migracion para estados canonicos, tabla unitaria y convivencia con `attendees`

## Links

- Requirement: `docs/pm-vault/01-Requirements/REQ-0012-catalogo-flexible-entradas-y-nominacion-posterior.md`
- ADR anterior: `docs/adr/2026-04-25-008-event-ticket-types-per-event.md`
