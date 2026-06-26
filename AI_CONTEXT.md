# AI_CONTEXT

> Primer archivo que un agente IA debe leer al retomar este repositorio.
> `AGENTS.md` define como trabajar; este archivo resume en que estado esta
> `babyclub-monorepo` ahora mismo.

## Identidad

- Proyecto: `babyclub-monorepo`
- Dominio: operacion de eventos BabyClub/Babyacces con compra publica,
  nominacion posterior, tickets QR, scanner de puerta, reservas de mesa,
  reportes y liquidaciones de promotores
- Stack principal: monorepo `pnpm` con `Next.js 16` en `apps/landing` y
  `apps/backoffice`, servicio legacy Node en `apps/api`, `Supabase` para datos,
  auth y storage, y paquetes compartidos en `packages/*`
- Version actual: rama `master` como deploy branch operativa

## Estado actual

- Fase activa: operacion y estabilizacion post slices de ticket packages,
  nominacion buyer-first, puerta, dashboard y hotfixes de produccion sobre
  mesas/tickets
- Resumen en una linea: el flujo publico y operativo ya soporta compra con
  nominacion posterior; los ultimos hotfixes cerraron la paridad de mesas
  legacy y la paginacion real del modulo de tickets, pero el proyecto sigue en
  hardening de reglas de QR por evento, scanner, reportes y liquidaciones
- Ultima actualizacion curada conocida: `2026-06-26 12:10:00 America/Lima`

## Features y estado

| Slice | Estado consolidado | Gates |
|---|---|---|
| ticket-types-per-event | cerrado y base canonica para catalogo vendible | `ADR-008=approved` |
| ticket-package-units-and-post-purchase-nomination | cerrado y publicado con buyer-first nomination; compatibilidad restaurada para mesas legacy sin asistentes | `ADR-009=approved` |
| duplicate-qr-guard-per-event | publicado en `master` para alta publica, reservas y puerta | `prod-smoke=pending` |
| door-scan-and-qr-summary-hardening | publicado con reglas para estados y clasificacion real | `event-smoke=pending` |
| admin-tickets-list-and-export | publicado con paginacion DB real y export sin truncar al primer bloque | `backoffice-smoke=pending` |
| promoter-settlements-ledger | operativo como MVP en backoffice/reportes | `commission-model=v1-manual` |
| online-payments-culqi | arquitectura preparada, disponibilidad productiva no habilitada | `provider-credentials=pending` |

## Gates pendientes

- `prod-smoke` - repetir smoke corto de compra, ticket, nominacion y scanner en
  entorno real despues de los ultimos hotfixes
- `backoffice-smoke` - validar manualmente `/admin/tickets` y export con sesion
  staff despues del hotfix de paginacion
- `commission-contract` - definir contrato administrable de comisiones antes de
  extender liquidaciones
- `culqi-go-live` - faltan credenciales, compliance y validacion real del
  proveedor

## Sesiones recientes

- **2026-06-26** - hotfix productivo para reservas `table` aprobadas sin
  `attendees`; buyer QR emitido y backfill de dos reservas legacy
- **2026-06-26** - hotfix productivo para bandeja/export de tickets truncados
  al primer bloque de Supabase/PostgREST
- **2026-05-31** - hotfix para bloquear duplicado de QR por evento antes de
  crear reservas `ticket-only`
- **2026-05-30** - cierre operativo de nominaciones, puerta y dashboard; tests
  clave y typechecks registrados en Obsidian
- **2026-05-30** - reenvio selectivo de nominaciones para `BABY RAVE | ABYSS`
  con correccion manual de un email invalido
- **2026-05-27** - cierre del slice `REQ-0012` con buyer-first nomination

## Decisiones recientes

- ADR-007: el sistema es single-tenant, single-organizer por deployment; no
  tratarlo como multi-tenant operativo
- ADR-008: `event_ticket_types` es el catalogo persistente de entradas por
  evento
- ADR-009: `ticket_reservation_units` es la unidad canonica por asistente/QR y
  la nominacion es el gate para emitir y usar
- Regla operativa vigente: aprobar una mesa sin asistentes debe preparar las
  unidades y emitir el QR del comprador antes del correo final
- Regla operativa vigente: una persona puede tener QRs en distintos eventos,
  pero solo `1 QR activo por evento`
- El dashboard debe distinguir unidades vendidas reales de QRs emitidos
- La bandeja y export de tickets no pueden paginar en memoria despues de una
  lectura truncada por proveedor

## Cautelas operativas

- La documentacion historica todavia mezcla lenguaje de `multi-organizer`; usar
  las ADRs como arbitro
- Antes de tocar el repo, correr `git status --short --branch` porque puede
  haber cambios locales no publicados
- Obsidian vive en
  `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo` y sirve
  como memoria curada, no como verdad tecnica final

## Proximos pasos

1. Tomar el bug o incidente actual con reproduccion exacta y area afectada
2. Confirmar si el problema cae en `landing`, `backoffice`, `supabase` o un
   cruce entre capas
3. Ejecutar el roster correcto: `Patroclo` para aterrizar el caso, `Echo` para
   reproducir, y luego `Vulcan` o `Neon` segun el modulo real
4. Mantener `Jarvis` si el cambio cruza arquitectura, deploy o multiples apps
5. Si el bug toca tickets antiguos "que no aparecen", confirmar primero si el
   problema es de visibilidad/paginacion o de emision real antes de asumir
   perdida de datos

## Como cargar contexto rapido

```bash
sed -n '1,220p' AI_CONTEXT.md
sed -n '1,240p' AGENTS.md
sed -n '1,240p' PROJECT_MAP.md
sed -n '1,220p' README.md
sed -n '1,220p' docs/ARCHITECTURE_V2.md
ls docs/adr
git status --short --branch
```

## Punteros clave

- `AGENTS.md` - roster oficial y reglas locales del repo
- `PROJECT_MAP.md` - mapa rapido del monorepo
- `README.md` - arranque, scripts y topologia local
- `docs/ARCHITECTURE_V2.md` - direccion de arquitectura y bounded contexts
- `docs/adr/2026-03-17-007-single-tenant-architecture-decision.md` - realidad
  de tenancy
- `docs/adr/2026-04-25-008-event-ticket-types-per-event.md` - catalogo
  vendible
- `docs/adr/2026-05-27-009-ticket-package-units-and-post-purchase-nomination.md`
  - unidad canonica de nominacion y QR
