# 2026-06-06 - Manual Payments And Event QR Guard Design

## Context

BabyClub necesita volver a operar en produccion con pago manual mientras Culqi
queda en pausa. En paralelo hay dos bugs operativos que hoy rompen el flujo:

1. eliminar mesas falla en backoffice;
2. el flujo publico mezcla la regla vigente de `1 QR activo por evento` con
   contadores historicos de reservas y deja inconsistencias entre compra y
   nominacion.

La realidad vigente del repo sigue siendo buyer-first para `ticket-only`:

- la unidad 1 pertenece al comprador y no se edita desde el workspace;
- una persona puede tener QRs en eventos distintos;
- dentro del mismo evento solo debe existir `1 QR activo por persona`.

## Goal

Dejar produccion en `manual-only` y corregir los dos bugs operativos sin abrir
refactor amplio de pagos, mesas o tenancy.

## Scope

### In

- ocultar y deshabilitar Culqi como camino operativo publico;
- mantener `Yape/Plin + voucher` como camino oficial de compra;
- reparar el endpoint y el contrato canonico para eliminar mesas;
- corregir el pre-check de identidad por evento para que use conflicto real de
  ticket activo y no conteo historico de reservas;
- impedir que una nominacion reuse el mismo documento del comprador o repita
  identidad dentro de la misma reserva.

### Out

- certificar Culqi, rehacer checkout o eliminar su backend;
- rediseñar el modelo de mesas o `table_availability`;
- permitir un flujo donde el comprador reserve para terceros sin ocupar la
  unidad 1;
- reabrir multi-tenant o cambios de arquitectura mayores.

## Design

### 1. Pago manual como modo oficial

Se agregara un kill switch explicito de runtime para checkout online. La regla
sera:

- si `DISABLE_CULQI_CHECKOUT=true`, la app publica no expone tarjeta aunque
  existan `ENABLE_CULQI_PAYMENTS`, secret key o public key;
- `GET /api/payments/status` devolvera Culqi deshabilitado cuando el kill switch
  este activo;
- los endpoints `create-order` y `charge` deben rechazar con `409` si ese switch
  esta activo, para que el backend no quede usable por error aunque alguien
  fuerce requests manuales.

En frontend `compra` y `registro` seguiran usando el selector de metodo de
pago, pero en produccion quedara solo el camino manual visible y operativo. El
copy del header y de la tarjeta de pago debe dejar de insinuar que Culqi esta
listo mientras siga apagado.

### 2. Delete de mesas

Hoy existen dos contratos de borrado:

- `/api/tables/delete` para soft delete de la mesa base;
- `DELETE /api/events/[id]/tables` para quitar disponibilidad de la mesa en un
  evento.

Para este slice se mantendra `/api/tables/delete` como contrato canonico de las
pantallas actuales que ya lo consumen. El fix debe cubrir:

- respuesta clara cuando la mesa no existe o no se pudo archivar;
- test dedicado del endpoint, hoy inexistente;
- normalizacion del consumo en clientes administrativos para que todos usen el
  mismo comportamiento esperado.

No se cambiara en este corte la semantica de `DELETE /api/events/[id]/tables`;
ese endpoint sigue siendo event-scoped y no reemplaza el archivado de la mesa
base.

### 3. Regla de QR por evento

El helper canonico ya existe en `shared/eventTicketIdentity`. El bug viene de
que una parte del flujo publico todavia consulta historial de
`table_reservations` y suma `ticket_quantity`.

Se hara este ajuste:

- el pre-check de `ticket-only` seguira usando conflicto real de ticket activo;
- el pre-check de mesas dejara de usar `total_tickets` historico y pasara a la
  misma regla de conflicto real;
- con buyer-first, si el comprador ya tiene `1 QR activo` para ese evento, la
  compra de mesa o ticket se bloquea antes del resumen.

Esto elimina el falso mensaje tipo "ya tienes 5 QR" y alinea el frontend con la
regla vigente.

### 4. Duplicados en nominacion

El POST inicial de `ticket-only` ya evita identidades duplicadas dentro de la
misma compra, pero el workspace posterior no replica esa proteccion.

Se agregara validacion en `PUT /api/ticket-reservations/[id]/units` para:

- rechazar si una unidad intenta reutilizar el documento de la unidad 1
  comprador;
- rechazar si dos unidades de la misma reserva quedan con la misma identidad
  normalizada;
- conservar la regla actual de que la unidad 1 no se edita desde el workspace.

La validacion usara el mismo criterio canonico de identidad:

- `document:doc_type:document`;
- `name_email`;
- `name_phone`.

El mensaje al usuario debe ser funcional, no un error crudo de constraint.

## Data And API Impact

- No se introduce migracion nueva para desactivar Culqi; el corte es runtime.
- No se requiere migracion para el pre-check por evento.
- La validacion de nominacion vive en API de aplicacion, no en DB, para no
  romper data legacy ni forzar constraint nueva en este hotfix.
- Los endpoints Culqi rechazarán cuando el switch este activo para reforzar el
  modo manual-only.

## Testing

Se agregaran o ajustaran tests focalizados para:

- `apps/landing/app/api/payments/status/route.test.ts`
- `apps/landing/app/api/check-ticket-reservation/route.test.ts`
- `apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts`
- `apps/backoffice/app/api/tables/delete/route.test.ts`

Verificacion final del slice:

```bash
pnpm exec vitest run \
  apps/landing/app/api/payments/status/route.test.ts \
  apps/landing/app/api/check-ticket-reservation/route.test.ts \
  'apps/landing/app/api/ticket-reservations/[id]/units/route.test.ts' \
  apps/backoffice/app/api/tables/delete/route.test.ts

pnpm typecheck:landing
pnpm typecheck:backoffice
```

## Risks

- Si negocio quiere permitir que alguien con QR activo compre una mesa para
  terceros, eso requiere un flujo nuevo donde el comprador no consuma la unidad
  1. Queda fuera de este corte.
- El bug de delete de mesa puede revelar un problema de datos remotos
  preexistente; por eso el endpoint necesita prueba local y mensaje claro.
- Culqi quedara apagado por switch, no removido. Eso es reversible, pero exige
  que produccion tenga el env alineado.

## Rollout

1. Publicar codigo con kill switch soportado.
2. Configurar produccion con `DISABLE_CULQI_CHECKOUT=true`.
3. Verificar en produccion:
   - `compra` y `registro` muestran solo pago manual;
   - borrar mesa ya no falla;
   - un comprador con historial viejo pero sin ticket activo no recibe el falso
     warning de `5 QR`;
   - una nominacion no puede repetir el documento del comprador ni duplicar
     identidad en otra unidad.
