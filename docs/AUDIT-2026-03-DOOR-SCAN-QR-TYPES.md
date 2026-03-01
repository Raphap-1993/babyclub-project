# AUDIT-2026-03-DOOR-SCAN-QR-TYPES

## Objetivo
Homologar la lectura QR en puerta para que el scanner muestre mensajes claros por tipo comercial de QR y valide reglas correctas por tipo.

## Cambios aplicados
- Persistencia de contexto comercial en `table_reservations`:
  - `sale_origin`: `table | ticket`
  - `ticket_pricing_phase`: `early_bird | all_night`
- API `POST /api/scan` ahora clasifica y devuelve:
  - `qr_kind`
  - `qr_kind_label`
  - `table_name`
  - `product_name`
  - `ticket_pricing_phase`
- UI de scanner (`/admin/door` y `/admin/scan`) migrada a componentes `shadcn/ui` locales (`Card`, `Button`, `Badge`, `Input`, `SelectNative`) y diseño mobile-first.

## Mapeo homologado de tipos QR
| qr_kind | Detección | Regla principal | Mensaje operador esperado |
|---|---|---|---|
| `table` | `table_id`/`table_reservation_id`/`code_type=table` | Validar uso único y estado activo | "QR de mesa válido" + mesa/pack |
| `ticket_early` | `ticket_pricing_phase=early_bird` | Validar uso único y estado activo | "Entrada EARLY válida" |
| `ticket_all_night` | `ticket_pricing_phase=all_night` | Validar uso único y estado activo | "Entrada ALL NIGHT válida" |
| `ticket_general` | `code_type=general` | Aplica límite horario de ingreso | "Entrada general" + estado horario |
| `promoter` | `code_type=promoter` | Uso único según cupos | "Entrada promotor" |
| `courtesy` | `code_type=courtesy` | Uso único según cupos | "Entrada cortesía" |
| `unknown` | sin contexto suficiente | Resolver manual/soporte | "QR no clasificado" |

## Casos E2E obligatorios (equipo)
1. Scan de QR mesa válido:
   - Debe mostrar `Tipo QR: Mesa / Box`
   - Debe mostrar `Mesa` y `Pack` cuando existan
2. Scan de QR EARLY válido:
   - Debe mostrar `Tipo QR: Entrada EARLY`
3. Scan de QR ALL NIGHT válido:
   - Debe mostrar `Tipo QR: Entrada ALL NIGHT`
4. Scan de QR general fuera de hora:
   - Debe devolver `Fuera de hora` y bloquear confirmación
5. Re-scan de QR ya usado:
   - Debe mostrar estado duplicado con mensaje explícito
6. QR de otro evento:
   - Debe mostrar mismatch e indicar nombre de evento origen
7. Door user en móvil:
   - Solo `/admin/door`
   - Flujo operable con controles principales visibles en viewport móvil

## Evidencia automatizada mínima
- Test API scan por clasificación:
  - `apps/backoffice/app/api/scan/route.test.ts`
- Build de apps:
  - `pnpm --filter backoffice build`
  - `pnpm --filter landing build`

## Riesgos abiertos
- Data legacy sin `ticket_pricing_phase` quedará como `unknown`/fallback por `code_type`.
- Si la migración no se aplica en ambiente, el scanner cae a query legacy sin romper el flujo, pero sin etiquetado de fase comercial.
