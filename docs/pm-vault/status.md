---
type: status
project: babyclub-monorepo
status: active
owner: Patroclo
updated: 2026-04-28
last_reviewed: 2026-04-28
---

# Status

## Snapshot

- El repo ya tiene una base documental fuerte en arquitectura y ADRs, pero no tenia una entrada minima para requerimientos nuevos.
- La memoria operativa diaria ahora vive en `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`.
- `docs/pm-vault/` queda como mirror repo-side para contexto tecnico cercano al codigo.
- La verdad formal de arquitectura sigue en [docs/adr/](../adr/README.md).
- La topologia local quedo fijada como `backoffice:3000`, `landing:3001`, `api legacy:4000`.
- El intake ya soporta distinguir `feature` vs `bugfix` antes de pasar a implementacion.
- El gate global `pnpm check-types` vuelve a correr via Turbo sobre los paquetes TypeScript activos.
- El runtime de `layout` ya lee el schema real y deja de depender de warnings por `layout_canvas_*`.
- Primeros P0 de Kevin Recovery cerrados a nivel repo: la landing ya no expone "Tarjeta" si Culqi no esta habilitado en runtime y los reportes promotor/no-show/ventas vuelven a pasar contrato de tests.

## Estado tecnico vigente

- Topologia activa: landing publica, backoffice administrativo y servicio API legacy.
- Regla vigente: single-tenant por deployment. Ver [ADR-007](../adr/2026-03-17-007-single-tenant-architecture-decision.md).
- Pagos online: integracion Culqi sigue pendiente de certificacion end-to-end; mientras tanto, tarjeta queda oculta si backend/public key no estan listos.
- Entradas publicas: tipos/lotes Early Baby y All Night ya tienen catalogo persistente por evento, snapshot de reserva y monto Culqi derivado desde BD.
- Reportes operativos: contrato de exportacion admin restaurado para asistencia, promotores, liquidacion por promotor, no-show QR free y ventas.
- Liquidaciones de promotores: ledger creado y aplicado en Supabase remoto para registrar pagos/beneficios, bloquear doble liquidacion y permitir monto editable por admin.
- Liquidaciones de promotores: tragos ocultos del modal/CSV operativo; la accion visible queda centrada en efectivo y estados.
- Liquidaciones de promotores: CRUD separado en `/admin/liquidaciones` y reporte consolidado en `/admin/reportes/liquidaciones`.
- Links de promotor: compras de entrada y reservas de mesa conservan `promoter_id`, `promoter_link_code_id` y `promoter_link_code` para trazabilidad de liquidaciones.
- Compra de 2 entradas: `/compra` permite capturar datos de la segunda persona y guardarlos en `table_reservations.attendees` para generar QRs individuales.
- Supabase remoto `babyclub-access`: aplicadas `20260428112000_add_ticket_reservation_attendees`, `20260428112100_add_promoter_link_trace_to_reservations` y `20260428112200_promoter_settlements_ledger`.
- `pnpm smoke:local` valida la landing sobre `http://localhost:3001`.

## Riesgos abiertos para siguientes requerimientos

- Existe documentacion historica con lenguaje "multi-organizer"; no debe usarse como verdad actual sin revisar ADR-007.
- La trazabilidad de requerimientos todavia depende de disciplina operativa; hay que mantener actualizada la matriz.
- Next detecta un lockfile externo en `/Users/rapha/package-lock.json`; no bloquea el dev local, pero deja warning al arrancar.
- El fix de `layout` quedo validado por codigo y tests; si se quiere cierre operativo total, falta observarlo una vez contra el entorno real que tenia el warning historico.
- Falta certificar pago real Culqi con credenciales validas antes de comunicar "tarjeta funcionando".
- Falta definir monto/regla de comision para reservas de mesa; las entradas y QR free ya tienen reglas MVP.
- Las migraciones historicas del repo usan nombres con guiones y la CLI de Supabase las omite; las migraciones nuevas de release se dejaron con timestamp valido `YYYYMMDDHHMMSS_nombre.sql`.

## Siguiente paso recomendado

- Usar [REQ-0003-primer-lote-requerimientos-y-correcciones.md](./01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md) como intake del primer lote.
- Cuando aparezca un item concreto, clonarlo a un REQ individual desde [99-Templates/tpl-requirement.md](./99-Templates/tpl-requirement.md).
- REQ tecnico cerrado mas reciente: [REQ-0011-liquidaciones-promotores-ledger.md](./01-Requirements/REQ-0011-liquidaciones-promotores-ledger.md), actualizado con CRUD separado, reporte consolidado y migraciones remotas aplicadas.
- Si el requerimiento toca tenancy, contratos API, auth, pagos, logs o migraciones, abrir revison de arquitectura antes de codificar.
