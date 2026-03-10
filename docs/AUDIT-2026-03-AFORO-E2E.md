# AUDIT-2026-03-AFORO-E2E

## Metadatos
- Fecha de auditoria: 2026-03-10
- Alcance: flujo E2E de aforo, emision de accesos, reservas/mesas, QR y lectura en puerta
- Metodo: lectura de codigo + snapshot real de Supabase con service role del workspace
- Limitacion: el analisis reconcilia el estado actual de BD al 2026-03-10; no reconstruye historicos fuera de lo persistido

## Resumen ejecutivo
- Estado general del flujo core: Rojo
- Problema 1 confirmado: el sistema no tiene un aforo total unificado. `events.capacity` solo limita el codigo general y no el total de accesos emitidos.
- Problema 2 confirmado: las metricas de puerta estan infladas por diseno. El backend registra un log `valid` en el pre-scan y otro `valid` al confirmar ingreso.
- Problema 3 confirmado: hoy conviven varios artefactos de acceso (`tickets.qr_token`, `codes.code`, `table_reservations.codes`) y no existe una unidad canonica de admision.

## Evidencia real del ultimo evento cerrado
Snapshot de BD del evento `LOVE IS A DRUG` al 2026-03-10:

| Metrica | Valor |
|---|---:|
| `events.capacity` | `119` |
| Tickets activos emitidos | `269` |
| Ingresos confirmados (`tickets.used = true`) | `130` |
| Logs de scan totales | `425` |
| Logs `valid` | `385` |
| Logs `valid` de pre-scan | `255` |
| Logs `valid` de confirmacion | `130` |
| Admisiones validas distintas | `130` |

Desglose de tickets activos:

| Categoria | Activos | Ingresos confirmados |
|---|---:|---:|
| Registro general | `119` | `26` |
| Venta de entradas por reserva (`sale_origin = ticket`) | `53` | `40` |
| Cortesias/promos con promotor | `65` | `45` |
| Reservas de mesa | `32` | `19` |

Conclusiones del snapshot:
- El evento excedio el aforo real en emision: `269 > 119`.
- El evento excedio el aforo real en ingresos confirmados: `130 > 119`.
- La cifra de scans validos no representa personas que ingresaron: `385` logs validos se explican por `255` pre-checks + `130` confirmaciones.

## Semaforo por checklist del AGENTS
| Area | Estado | Evidencia | Comentario |
|---|---|---|---|
| 1) Dominio y limites de modulos | Rojo | `apps/landing/app/api/tickets/route.ts:259`, `apps/landing/app/api/reservations/route.ts:213`, `apps/backoffice/app/api/admin/reservations/route.ts:293`, `apps/backoffice/app/api/scan/route.ts:224` | La logica de cupo/admision esta fragmentada entre `codes`, `tickets`, `table_reservations` y `scan_logs`. |
| 2) API y contratos | Rojo | `apps/landing/app/api/aforo/route.ts:22`, `apps/backoffice/app/api/admin/reports/export/route.ts:47`, `apps/backoffice/app/api/scan/confirm/route.ts:115` | Distintos endpoints cuentan cosas distintas: aforo general, tickets activos, scans validos o confirmaciones. |
| 3) Datos y migraciones | Amarillo | `supabase/migrations/2026-02-10-link-tickets-to-table-reservations.sql:4`, `supabase/migrations/2026-03-01-add-reservation-commercial-context.sql:4` | Hay mejoras aditivas, pero no existe una tabla o ledger unico de admision/capacidad. |
| 4) Seguridad | Rojo | `scripts/audit-codes.js:4`, `scripts/run-migration.sh:4`, `scripts/migrate-table-availability.mjs:12`, `scripts/check-migration.mjs:7`, `scripts/run-migration.mjs:11` | Hay credenciales Supabase embebidas en repo, contradiciendo el principio de secretos por ambiente. |
| 5) Calidad y pruebas | Amarillo | `apps/backoffice/app/api/scan/route.test.ts`, `apps/backoffice/app/api/scan/confirm/route.test.ts`, `apps/landing/app/api/reservations/route.test.ts` | Hay pruebas por endpoint, pero no hay test E2E que reconcilie aforo emitido vs aforo confirmado. |
| 6) Operacion y observabilidad | Rojo | `apps/backoffice/app/api/scan/route.ts:380`, `apps/backoffice/app/api/scan/confirm/route.ts:115`, `apps/backoffice/app/api/admin/reports/export/route.ts:52` | `scan_logs` no diferencia intento de validacion vs ingreso confirmado. El dashboard puede sobrecontar casi 3x. |
| 7) CI/CD y gobernanza | Amarillo | `package.json`, `scripts/` | Hay base de scripts, pero faltan herramientas oficiales para auditar aforo por evento y persisten scripts legacy inseguros. |

## Flujo E2E actual
### 1. Registro general / marketing
- UI publica exige `promoter_id` si el selector no esta oculto: `apps/landing/app/registro/page.tsx:711`.
- La generacion real pasa por `POST /api/tickets`: `apps/landing/app/registro/page.tsx:1666`.
- El endpoint valida cupos solo contra el codigo ingresado (`codes.max_uses`), no contra el total emitido del evento: `apps/landing/app/api/tickets/route.ts:259`.

### 2. Venta online de entradas (sin codigo)
- La compra publica crea una `table_reservations` con `sale_origin = 'ticket'`: `apps/landing/app/api/ticket-reservations/route.ts:111`.
- Los tickets reales no se crean alli; quedan pendientes hasta aprobacion posterior.
- Cuando se aprueba la reserva, se generan tickets/codigos via `apps/backoffice/app/api/reservations/update/route.ts:149`.

### 3. Reserva de mesa
- La reserva publica crea una `table_reservations` con `sale_origin = 'table'` y genera codigos por persona: `apps/landing/app/api/reservations/route.ts:248` y `apps/landing/app/api/reservations/route.ts:286`.
- La aprobacion posterior genera tickets adicionales por cada cupo: `apps/backoffice/app/api/reservations/update/route.ts:164`.

### 4. Reserva manual desde backoffice
- `POST /api/admin/reservations` tiene un flujo distinto.
- En `new_customer` crea solo un ticket inicial y luego varios codigos: `apps/backoffice/app/api/admin/reservations/route.ts:293` y `apps/backoffice/app/api/admin/reservations/route.ts:345`.
- En `existing_ticket` reutiliza un ticket existente y tambien genera varios codigos: `apps/backoffice/app/api/admin/reservations/route.ts:203` y `apps/backoffice/app/api/admin/reservations/route.ts:244`.
- Este flujo no es equivalente al flujo publico aprobado y aumenta la heterogeneidad de artefactos QR.

### 5. Lotes de cortesia/promotor
- Los lotes se generan con RPC `generate_codes_batch`: `supabase/migrations/2025-02-14-use-courtesy-type-for-promoter-codes.sql:13`.
- Por compatibilidad legacy, los lotes de promotor se guardan como `codes.type = 'courtesy'`: `supabase/migrations/2025-02-14-use-courtesy-type-for-promoter-codes.sql:103`.
- Resultado: promo/free y cortesia quedan mezclados a nivel de tipo de codigo.

### 6. Validacion en puerta
- `POST /api/scan` registra un `scan_logs.result = 'valid'` apenas el QR pasa la validacion preliminar: `apps/backoffice/app/api/scan/route.ts:380`.
- `POST /api/scan/confirm` vuelve a registrar otro `scan_logs.result = 'valid'` al confirmar el ingreso: `apps/backoffice/app/api/scan/confirm/route.ts:115`.
- Los reportes consumen `scan_logs` filtrando `result = 'valid'`: `apps/backoffice/app/api/admin/reports/export/route.ts:47`.
- No existe un estado persistido de `confirmed` en `scan_logs`.

## Hallazgos priorizados
### H1. Los reportes de puerta estan inflados por duplicacion de logs
- Severidad: Alta
- Evidencia de codigo:
  - `apps/backoffice/app/api/scan/route.ts:380`
  - `apps/backoffice/app/api/scan/confirm/route.ts:115`
  - `apps/backoffice/app/api/admin/reports/export/route.ts:47`
- Evidencia de datos:
  - `LOVE IS A DRUG`: `385` logs `valid`, pero solo `130` admisiones validas distintas.
  - Ratio actual: `2.96` logs validos por admision real.
- Impacto:
  - Las cifras de “lecturas” no representan personas.
  - La operacion puede creer que entraron 300+ cuando en realidad confirmo ~130.

### H2. `events.capacity` no controla el aforo total del evento
- Severidad: Alta
- Evidencia de codigo:
  - `set_event_general_code` usa `events.capacity` para el codigo general: `supabase/migrations/2026-02-08-fix-code-uniqueness.sql:99`
  - No hay verificacion global de capacidad en:
    - `apps/landing/app/api/tickets/route.ts`
    - `apps/landing/app/api/ticket-reservations/route.ts`
    - `apps/landing/app/api/reservations/route.ts`
    - `apps/backoffice/app/api/admin/reservations/route.ts`
    - `apps/backoffice/app/api/reservations/update/route.ts`
- Evidencia de datos:
  - `LOVE IS A DRUG`: `269` tickets activos con aforo configurado de `119`.
  - `130` ingresos confirmados para un aforo de `119`.
- Impacto:
  - Marketing, cortesia, entradas pagadas y mesas compiten fuera de un mismo cupo total.

### H3. El aforo publico de la landing solo mide el codigo general
- Severidad: Alta
- Evidencia de codigo:
  - `apps/landing/app/api/aforo/route.ts:22`
  - `apps/landing/app/api/aforo/route.ts:44`
  - `apps/landing/app/registro/page.tsx:431`
- Detalle:
  - `/api/aforo` toma el codigo consultado, calcula capacidad desde `codes.max_uses` o `events.capacity` y cuenta tickets solo por `code_id`.
  - No suma tickets emitidos por reservas de mesa, ventas sin codigo ni cortesia/promotor.
- Evidencia de datos:
  - En `LOVE IS A DRUG` el pool general activo es `119`, pero el total emitido activo es `269`.
- Impacto:
  - La barra de aforo no representa el aforo real del evento.

### H4. Hoy no existe un QR unico por admision en todos los flujos
- Severidad: Alta
- Evidencia de codigo:
  - Flujo publico aprobado genera ticket por cupo: `apps/backoffice/app/api/reservations/update/route.ts:164`
  - Flujo admin `new_customer` crea un ticket + varios codigos: `apps/backoffice/app/api/admin/reservations/route.ts:293`
  - Flujo admin `existing_ticket` reusa un ticket + varios codigos: `apps/backoffice/app/api/admin/reservations/route.ts:203`
- Impacto:
  - Algunas admisiones viven como `tickets.qr_token`, otras como `codes.code`.
  - La trazabilidad por persona y por cupo no es uniforme.

### H5. `table_products.tickets_included` no controla la cantidad real de QR
- Severidad: Media
- Evidencia de codigo:
  - Campo existe en esquema: `supabase/tables_products.sql:10`
  - Reserva publica usa `tables.ticket_count`: `apps/landing/app/api/reservations/route.ts:108`
  - Reserva admin usa `tables.ticket_count`: `apps/backoffice/app/api/admin/reservations/route.ts:72`
- Impacto:
  - Si cada pack/box deberia incluir distinto numero de accesos, hoy el sistema no lo aplica.
  - La fuente real de cupos por mesa no esta definida en un solo lugar.

### H6. Promotor y cortesia estan mezclados en el tipo de codigo
- Severidad: Media
- Evidencia:
  - La RPC downgrada `promoter -> courtesy`: `supabase/migrations/2025-02-14-use-courtesy-type-for-promoter-codes.sql:103`
  - El resumen QR por tipo agrega por `c.type`: `supabase/migrations/2026-02-13-promoters-friendly-codes-and-summary-rpc.sql:149`
- Impacto:
  - Los reportes por tipo comercial pierden precision.
  - “Free”, “cortesia” y “promotor” no estan separados de forma confiable.

### H7. Hay secretos en el repo
- Severidad: Alta
- Evidencia:
  - `scripts/audit-codes.js:4`
  - `scripts/run-migration.sh:4`
  - `scripts/migrate-table-availability.mjs:12`
  - `scripts/check-migration.mjs:7`
  - `scripts/run-migration.mjs:11`
- Impacto:
  - Riesgo operativo inmediato.
  - Incumple el principio del AGENTS: “Secretos gestionados por ambiente, nunca en repo”.

## Top 5 riesgos actuales
| Riesgo | Severidad | Owner sugerido | Fecha objetivo |
|---|---|---|---|
| Inflado de ingresos por doble log en puerta | Alto | Backend + Operaciones | 2026-03-12 |
| Aforo total no unificado entre general, promos, ticket sales y mesas | Alto | Arquitectura + Backend | 2026-03-14 |
| Barra de aforo publica engañosa | Alto | Landing + Producto | 2026-03-13 |
| Artefactos QR heterogeneos entre flujos public/admin | Alto | Tech Lead Backend | 2026-03-17 |
| Secretos de Supabase comprometidos en `scripts/` | Alto | DevOps + Seguridad | 2026-03-11 |

## Recomendaciones
### Acciones inmediatas (24-72h)
1. Separar en puerta `precheck` de `confirm`:
   - O dejar de escribir `scan_logs` en `/api/scan`.
   - O agregar `stage = precheck|confirm` y reportar solo `confirm`.
2. Corregir reportes:
   - `event_attendance` debe contar confirmaciones o admisiones distintas, no todos los `valid`.
3. Congelar la interpretacion de `/api/aforo`:
   - No usarlo como aforo total hasta reemplazarlo por un consolidado real.
4. Rotar y eliminar secretos embebidos en `scripts/`.

### Acciones estructurales (1 sprint)
1. Definir una unidad canonica de capacidad:
   - Recomendado: una fila por admision (`event_access_units` o similar).
   - Campos minimos: `event_id`, `source_type`, `source_id`, `status`, `promoter_id`, `table_id`, `reservation_id`, `ticket_id`, `qr_token`.
2. Hacer que toda emision pase por un solo servicio:
   - General, pago, mesa y promo deben reservar/emiten la misma unidad de aforo.
3. Unificar QR:
   - Un QR unico por admision.
   - Los codigos comerciales deben quedar como origen/autorizacion, no como segundo artefacto de entrada.
4. Definir la fuente real de cupos por mesa:
   - Si manda `table_products.tickets_included`, migrar el flujo.
   - Si manda `tables.ticket_count`, remover el campo o dejarlo solo informativo.

### Acciones V2 alineadas al Strangler
1. Extraer `Door Scanning` a `/v2/scan` con operacion transaccional y stage explicito.
2. Extraer `Tickets & QR` a `/v2/tickets` con idempotencia y emision uniforme.
3. Extraer `Reservations` a `/v2/reservations` con politica unica de capacidad.

## Herramienta nueva para repetir la auditoria
Se agrega script read-only:

```bash
node scripts/audit-event-capacity.js --latest-past
node scripts/audit-event-capacity.js --event-id <uuid>
node scripts/audit-event-capacity.js --event-name "LOVE IS A DRUG"
```

El script:
- carga `.env.local` automaticamente
- consolida tickets, codigos, reservas y scans del evento
- separa emisiones activas vs ingresos confirmados
- detecta duplicacion entre pre-scan y confirmacion

## Decision recomendada
Antes de tocar UI o “aforo marketing”, la prioridad correcta es:
1. arreglar la metrica de puerta,
2. definir el aforo total como regla transversal,
3. unificar el artefacto de admision.

Si no se hace en ese orden, cualquier ajuste de marketing/mesas va a seguir moviendo numeros distintos en cada modulo.
