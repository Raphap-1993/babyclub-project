# SAAS READINESS 2026-03

> **Contexto de arquitectura actual (2026-03-17):** El sistema es **single-tenant por deployment** — un deployment sirve a un único organizer identificado por `NEXT_PUBLIC_ORGANIZER_ID`. No existe aislamiento de tenant, membership table ni auth scoped por tenant. Esta auditoría documenta qué se necesitaría para evolucionar hacia un SaaS multi-tenant. Ver ADR-007.

## Objetivo
Definir si BabyClub debe venderse como:
- software a medida
- white-label administrado
- licencia anual
- SaaS multi-tenant

Y validar si la arquitectura actual soporta ese objetivo para un primer hito de `100` cuentas/organizadores.

## Recomendacion ejecutiva
- Recomendacion principal: `no saltar hoy a full SaaS self-service`.
- Recomendacion realista:
  1. `Managed white-label` para `3-10` clientes
  2. `Multi-tenant administrado` para `10-25` clientes
  3. `SaaS verdadero` cuando cierres tenant isolation, branding por tenant, memberships y CI/gates

## Por que no ir a full SaaS hoy
- El repo ya soporta `multi-organizer`, pero no `multi-tenant estricto`.
- Hay scoping por `organizer_id`, pero no una capa consistente de `tenant membership`.
- La marca publica aun mezcla modelo `global` y modelo `por organizer`.
- Varios endpoints dependen de `SUPABASE_SERVICE_ROLE_KEY` en tiempo de request.
- Falta endurecer validacion, observabilidad y permisos por tenant.

## Lo que si tienes hoy
- `landing` publica
- `backoffice` administrativo amplio
- `organizers`
- `events.organizer_id`
- `promoters.organizer_id`
- `payments.organizer_id`
- `tables.organizer_id`
- layout por organizer
- pagos Culqi
- QR + scan en puerta

Eso alcanza para vender `operacion multi-cliente administrada por ustedes`.

## Modelo comercial recomendado
## Etapa 1. Managed white-label
### Como funciona
- ustedes crean el organizer
- ustedes configuran branding, layout, eventos, pasarela y staff
- el cliente opera su evento
- ustedes cobran setup + fee mensual o por evento

### Cuando usarlo
- hoy mismo
- con 1 sola base de datos
- sin self-service completo

### Pricing sugerido
- Setup inicial: `USD 2k - 8k`
- Fee mensual: `USD 300 - 1,500`
- O fee por evento: `USD 200 - 1,000`
- O fee variable: `0.5% - 2.0%` de GMV

### Ventajas
- monetizas rapido
- aprendes que piden los clientes
- no sobrediseñas arquitectura
- subes valor del producto antes de venderlo

## Etapa 2. Licencia anual operada
### Como funciona
- das una instancia compartida o semi-dedicada
- un grupo empresarial o agencia usa su organizer
- incluyes soporte, onboarding y SLA

### Pricing sugerido
- Licencia anual: `USD 12k - 30k`
- Setup y customizaciones: aparte
- Soporte premium: aparte

### Cuando usarlo
- para venues, grupos o promotores medianos
- cuando no quieres ceder IP

## Etapa 3. SaaS multi-tenant
### Como funciona
- cada cliente se autoadministra
- crea eventos, branding, mesas, staff y reportes
- el tenant se resuelve por dominio, subdominio o slug

### Condicion para lanzarlo
- tenant isolation por diseño
- memberships por organizer
- branding por tenant
- auth y permisos por tenant
- CI limpio

## Recomendacion de producto
- El mejor camino no es `vender el software` primero.
- El mejor camino es:
  - `licenciarlo`
  - `probarlo con clientes`
  - `convertirlo en SaaS`
  - y luego, si quieres, vender el negocio o la plataforma

## Arquitectura recomendada para 100 cuentas
## Principio
- Para `100` cuentas no necesitas microservicios.
- Necesitas `modular monolith + tenancy fuerte`.
- Supabase + Next + Vercel te alcanza para esa etapa si corriges aislamiento y hotspots.

## Que significa “100 cuentas”
- `100` organizers/tenants activos
- `1` base compartida
- `1` API compartida
- aislamiento logico fuerte por tenant

## Modelo de tenancy recomendado
### Opcion recomendada
- Reusar `organizers` como `tenant`

### Tablas necesarias
- `organizers`
  - ya existe
  - pasa a ser la tabla canonica de tenant
- `organizer_memberships`
  - `id`
  - `organizer_id`
  - `staff_id`
  - `role_code`
  - `status`
  - `is_owner`
  - `created_at`
- `organizer_domains`
  - `id`
  - `organizer_id`
  - `domain`
  - `is_primary`
  - `ssl_status`
- `organizer_branding`
  - si no quieres seguir sobrecargando `organizers`
  - `logo_url`
  - `primary_color`
  - `secondary_color`
  - `font_family`
  - `cover_image`
  - `favicon_url`
- `organizer_settings`
  - moneda
  - timezone
  - locale
  - sales toggles
  - receipts config
- `organizer_billing`
  - plan
  - contract_type
  - monthly_fee
  - gm_percent
  - status

## Datos que deben quedar tenant-scoped
- `events.organizer_id`
- `tables.organizer_id`
- `promoters.organizer_id`
- `payments.organizer_id`
- `codes.organizer_id` o derivable por evento pero indexado
- `tickets.organizer_id` o derivable por evento pero indexado
- `table_reservations.organizer_id`
- `process_logs.organizer_id`
- `staff` no basta solo
- hace falta `staff <-> organizer` via membership

## Regla de seguridad
- Ningun staff debe ver datos de un organizer que no le pertenece.
- Eso no debe depender de un query param.
- Debe resolverse desde:
  - token
  - membership
  - tenant actual

## Resolucion de tenant
### Fase 1
- por `organizer_id` o `slug` en URL
- ejemplo:
  - `/o/babyclub/...`
  - `/o/otro-organizer/...`

### Fase 2
- por dominio custom
- ejemplo:
  - `entradas.cliente.com`

## Recomendacion concreta
- Empieza con `slug` y no con subdominios custom.
- Es mucho mas simple de operar y depurar.

## Target de backend
## No recomendado
- seguir agregando reglas dentro de handlers `route.ts`

## Recomendado
- crear la V2 definida en `docs/ARCHITECTURE_V2.md`
- agregar:
  - `apps/api-v2`
  - `packages/domain`
  - `packages/db`
  - `packages/contracts`

## Contrato interno sugerido
- `middleware -> tenant context -> auth context -> use case -> repository`

## Ejemplo
- request entra por host o slug
- middleware resuelve `organizer_id`
- auth resuelve `staff_id` y memberships
- policy valida acceso al tenant
- caso de uso ejecuta
- repositorio agrega filtro tenant

## Politica tecnica para 100 cuentas
- `1` DB compartida
- `1` cluster Supabase
- `1` API
- indices por `organizer_id + event_id + deleted_at`
- reportes pesados por SQL agregada o materialized views
- `Redis/Upstash` para rate limiting compartido
- `correlation_id` por request

## Que no necesitas aun
- multi-db por tenant
- Kubernetes
- microservicios
- event bus complejo

## Hallazgos de arquitectura actual
## A. Branding aun no es SaaS-ready
### Evidencia
- `apps/landing/app/api/branding/route.ts` lee `brand_settings` con `id = 1`
- `apps/landing/lib/branding.ts` tambien lee `brand_settings` con `id = 1`
- `apps/backoffice/app/api/branding/save/route.ts` hace `upsert({ id: 1, logo_url })`

### Diagnostico
- eso es branding global
- no branding por cliente

### Cambio requerido
- mover la landing a branding resuelto por `organizer_id` o `slug`
- usar `organizers.logo_url` como minimo
- idealmente crear `organizer_branding`

## B. El aislamiento por tenant no se resuelve desde la sesion
### Evidencia
- `apps/backoffice/app/api/admin/events/route.ts` acepta `organizer_id` por query param
- `packages/shared/auth/requireStaff.ts` devuelve rol, pero no memberships por organizer

### Diagnostico
- hoy el auth valida identidad y rol
- no valida alcance tenant

### Cambio requerido
- agregar `organizer_memberships`
- enriquecer `staff-context`
- toda ruta admin debe resolver `allowed_organizer_ids`

## C. Hay endpoints sensibles sin auth directa
### Evidencia
- `apps/backoffice/app/api/organizers/[id]/layout/route.ts` hace `PUT` y no llama a `requireStaffRole`
- `apps/backoffice/app/api/tickets/[id]/route.ts` expone ticket + PII sin auth
- `apps/backoffice/app/api/persons/search/route.ts` expone persona por DNI sin auth
- `apps/backoffice/app/api/reniec/dni/[dni]/route.ts` no tiene auth ni rate limit

### Diagnostico
- para un SaaS esto es deuda seria
- mezcla endpoints internos con superficie accesible

### Cambio requerido
- cerrar todas las rutas internas con auth/policy
- separar claramente:
  - public API
  - staff API
  - tenant-admin API

## D. Validacion de payloads es manual y no uniforme
### Evidencia
- no se detectaron rutas usando `zod`/`safeParse` en los handlers

### Diagnostico
- el repo valida con `typeof`, `trim`, `Number(...)`
- eso funciona, pero escala mal y vuelve inconsistente la API

### Cambio requerido
- estandarizar DTOs con `zod`
- respuestas de error consistentes
- codigos de error estables

## E. Service role se usa demasiado en rutas publicas
### Evidencia
- `19` de `20` rutas de `apps/landing/app/api` usan `SUPABASE_SERVICE_ROLE_KEY`

### Diagnostico
- esto acelera desarrollo
- pero para SaaS aumenta riesgo operacional y obliga a confiar en filtro app-layer

### Cambio requerido
- reducir service role en lectura publica donde no haga falta
- reservar service role para server-only operations muy justificadas
- aplicar RLS o capa repositorio estricta

## F. Rate limiting esta incompleto para SaaS
### Evidencia
- solo `4` de `20` rutas publicas de landing usan `rateLimit`
- `docs/SECURITY.md` indica storage `in-memory`

### Diagnostico
- para varias instancias o varios clientes no es suficiente

### Cambio requerido
- mover rate limiting a storage compartido
- cubrir:
  - `tickets`
  - `payments/create-order`
  - `webhook`
  - `persons/search`
  - `reniec`

## G. Idempotencia esta bien encaminada solo en pagos
### Evidencia
- `apps/landing/app/api/payments/culqi/create-order/route.ts` exige `idempotency_key`
- `apps/landing/app/api/payments/culqi/webhook/route.ts` deduplica eventos webhook

### Diagnostico
- muy bien para Culqi
- todavia no uniforme en tickets/reservations/scan

### Cambio requerido
- llevar el mismo patron a:
  - `/tickets`
  - `/reservations`
  - `/scan/confirm`

## H. Documentacion y codigo no estan 100% alineados
### Evidencia
- `docs/MULTI-EVENT-SYSTEM.md` marca como completado que cada staff ve solo su organizer
- el codigo revisado no lo resuelve automaticamente desde membership

### Diagnostico
- el target esta claro
- la implementacion aun no cierra esa promesa

## Conclusión tecnica
- La arquitectura actual `si` sirve para vender a mas clientes `si ustedes operan la plataforma`.
- La arquitectura actual `todavia no` es el SaaS multi-tenant limpio que deberia autoadministrarse por 100 clientes.

## Plan recomendado
## Fase 1. Comercial ya
### Objetivo
- vender a mas empresas ya

### Tecnico
- mantener shared DB
- crear organizer por cliente
- operar por slug o `organizer_id`
- onboarding manual

### Comercial
- vender como:
  - white-label administrado
  - licencia anual
  - fee por evento

## Fase 2. SaaS foundation
### Objetivo
- dejar base tecnica correcta

### Cambios minimos
1. Crear `organizer_memberships`
2. Resolver tenant desde host/slug
3. Eliminar branding global `id=1`
4. Cerrar endpoints internos sin auth
5. Agregar `zod`
6. Agregar `check-types` real en Turbo
7. Agregar CI visible
8. Añadir `organizer_id` a logs y reportes

## Fase 3. API modular
### Objetivo
- soportar cambios rapidos sin romper V1

### Cambios
- `apps/api-v2`
- `packages/domain`
- `packages/db`
- contratos versionados

## Fase 4. SaaS verdadero
### Objetivo
- self-service controlado

### Habilitar
- signup de organizer
- onboarding wizard
- branding self-service
- staff invitations
- billing
- planes
- dominios custom

## Recomendacion final
- `Si quieres vender ya`: vende `managed white-label`
- `Si quieres construir patrimonio`: licencialo primero
- `Si quieres un SaaS real`: primero arregla tenancy y seguridad, luego abre self-service

## Dictamen
- Para `100` cuentas, la tecnologia actual es suficiente en volumen.
- Lo que falta no es “escala de infraestructura”.
- Lo que falta es `escala de producto multi-tenant`.
- El cuello hoy es:
  - aislamiento tenant
  - branding por cliente
  - permisos por organizer
  - consistencia de endpoints
  - release governance
