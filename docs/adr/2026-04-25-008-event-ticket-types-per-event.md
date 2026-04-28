## ADR-008 - Catalogo persistente de tipos de entrada por evento

**Fecha:** 2026-04-25
**Estado:** Aprobado

## Contexto

BabyClub vende entradas publicas con variantes comerciales Early Baby y All Night, cada una en 1 QR y 2 QR. Hasta ahora el flujo dependia de constantes y columnas legacy en `events`, lo que dejaba el precio y la disponibilidad repartidos entre UI, API y pago.

Kevin pidio dejar el flujo local listo para Culqi y que el reemplazo final sea de credenciales/API, no de arquitectura funcional.

## Decision

Crear `event_ticket_types` como catalogo persistente por evento:

- `code`: identificador estable de la opcion vendible.
- `sale_phase`: `early_bird` o `all_night`.
- `ticket_quantity`: cantidad de QR emitidos por compra.
- `price` y `currency_code`: monto total de la opcion.
- `is_active` y `sort_order`: visibilidad y orden publico.

`table_reservations` guarda snapshot de la opcion elegida:

- `ticket_type_id`
- `ticket_type_code`
- `ticket_type_label`
- `ticket_unit_price`
- `ticket_total_amount`

Las columnas legacy del evento se mantienen como fallback y fuente de sincronizacion inicial para los cuatro tipos base.

## Consecuencias

- El backend calcula el monto desde BD, no desde el cliente.
- Las reservas conservan monto historico aunque luego se edite el evento.
- Culqi usa `ticket_total_amount` para reservas ticket-only.
- El scanner puede mostrar la etiqueta real de entrada comprada.
- No se introduce multi-tenant; se mantiene ADR-007.

## Alternativas consideradas

- Mantener solo columnas en `events`: descartado porque no escala a labels, mensajes, orden, activacion ni snapshot limpio.
- Confiar en monto enviado por landing: descartado por riesgo de manipulacion y desalineacion con reservas historicas.

## Verificacion

- Tests compartidos de normalizacion de tipos.
- Test de API de reservas ticket-only con snapshot de monto.
- Test de pago Culqi usando snapshot de reserva.
- Test de scanner con etiqueta persistida.
- Build de landing para validar flujo publico y fix de import.

## Riesgos

- La migracion debe aplicarse antes de validar contra data real.
- El editor avanzado de tipos queda como siguiente iteracion sobre esta tabla.
- Culqi real requiere credenciales definitivas y prueba contra sandbox/proveedor antes de comunicar disponibilidad productiva.
