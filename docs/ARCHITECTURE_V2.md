# ARCHITECTURE V2 (Target)

V2 sera una API modular dentro del mismo monorepo, manteniendo la BD actual en Supabase. El enfoque es Strangler: V1 sigue vivo mientras V2 reemplaza modulos uno por uno.

## Componentes propuestos

- `apps/api-v2` (o `apps/core-api`): API modular con rutas `/v2/*`
- `packages/domain`: entidades + casos de uso (reglas de negocio)
- `packages/db`: repositorios y acceso a Supabase (query layer)
- `packages/shared`: utilidades transversales (documentos, fechas, email)

## Bounded Contexts (Dominios)

1) Identity/Auth
   - Sesion + roles de staff (staff_roles)
   - Requerido para endpoints admin

2) Events & Branding
   - Eventos, manifiesto, cover/header, branding, layout

3) Codes (generic vs special)
   - Tipos: general, courtesy, promoter, table
   - Reglas de uso/expiracion/limites

4) Tickets & QR
   - Creacion de tickets con QR interno
   - Idempotencia obligatoria

5) Door Scanning
   - Validacion en puerta con transaccion
   - Logs en scan_logs

6) Tables/Combos/Reservations
   - Mesas, productos, reservas con voucher
   - Estados consistentes

7) Payments (Culqi)
   - Idempotencia, webhooks, reconciliacion

8) Notifications (Email)
   - Plantillas consistentes
   - Cola simple con reintentos

## Reglas de negocio clave (flujo actual)

- Codigo generico (general): ticket free con warning de hora limite
- Codigo invitado/promotor: sin warning ni hora limite
- Registro con DNI: buscar en persons; si no existe usar PeruAPI
- Reservas con mesas/combos y pago Culqi (pendiente en V1)
- Validacion en puerta desde web/PWA (sin app nativa)

## Principios de diseno

- API-first: V2 expone endpoints compatibles con V1
- Strangler routing: V1 consume `/v2/*` modulo por modulo
- Data safety: sin borrados, migraciones aditivas
- Idempotencia en flujos criticos (tickets, pagos)
- Observabilidad: logs en `process_logs` con correlation_id

## Contratos V2 (iniciales)

- POST `/v2/scan` -> RPC transaccional `scan_ticket()` en Supabase
- POST `/v2/tickets` -> crea ticket (idempotency-key obligatorio)
- POST `/v2/reservations` -> reserva mesa + combos
- POST `/v2/payments/*` -> Culqi (futuro)
- POST `/v2/notifications/tickets/:id/email` -> envio controlado

## Datos (Supabase)

- Se mantiene el esquema actual
- Solo se agregan columnas/indices cuando V2 lo requiera
- Backfills por lotes y validacion posterior

## Seguridad

- Todas las rutas admin requieren staff auth + rol
- Rate limiting en rutas publicas sensibles
- QR generado localmente (no externo)
