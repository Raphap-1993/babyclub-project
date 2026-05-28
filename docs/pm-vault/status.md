---
type: status
project: babyclub-monorepo
status: active
owner: Patroclo
updated: 2026-05-28
last_reviewed: 2026-05-28
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
- `REQ-0012` ya quedo implementado en branch aislada con catalogo flexible por evento, compra por `package_quantity`, workspace publico de nominacion posterior, emision por unidad y gate de scanner por estado unitario.
- Backoffice promotores: la creacion ya rehidrata promotores archivados para la misma persona/organizer y evita duplicados activos al reintentar el alta.
- Landing mesas: `registro` y `compra` ya enfocan el grupo real de mesas al abrir el croquis, evitando que se vean demasiado pequeñas en desktop/mobile.
- Scanner y QR de mesa/box: cada codigo de una misma reserva ya puede emitir tickets independientes aunque repita comprador, el scanner no los bloquea por DNI duplicado y ahora muestra el tipo comercial en paneles de color mas evidentes.
- Correos de tickets: el endpoint publico `/api/tickets/email` ya usa el sender compartido con `process_logs`, no devuelve exito falso si Resend responde error y normaliza dominios de destinatario antes de enviar.
- Dashboard tickets: el resumen QR ya solo clasifica `mesa` cuando el ticket tiene `table_id`; las compras ticket-only dejan de inflar la cuenta/composicion de mesas en home.
- Ticket publico: la vista `/ticket/[id]` ya separa `Mesa / Box`, `QR promotor`, `QR cortesia`, `QR libre`, `QR general` y `ticket-only` con copy/tonos distintos; deja de usar el bloque ambiguo `QR de mesa / promotor`.
- Dashboard QR remoto: el RPC `public.get_qr_summary_all` ya fue aplicado puntualmente en `babyclub-access` via `supabase db query --linked -f supabase/manual/2026-05-28-hotfix-get_qr_summary_all.sql`, sin empujar las otras migraciones pendientes del branch.

## Riesgos abiertos para siguientes requerimientos

- Existe documentacion historica con lenguaje "multi-organizer"; no debe usarse como verdad actual sin revisar ADR-007.
- La trazabilidad de requerimientos todavia depende de disciplina operativa; hay que mantener actualizada la matriz.
- Next detecta un lockfile externo en `/Users/rapha/package-lock.json`; no bloquea el dev local, pero deja warning al arrancar.
- El fix de `layout` quedo validado por codigo y tests; si se quiere cierre operativo total, falta observarlo una vez contra el entorno real que tenia el warning historico.
- Falta certificar pago real Culqi con credenciales validas antes de comunicar "tarjeta funcionando".
- Falta definir monto/regla de comision para reservas de mesa; las entradas y QR free ya tienen reglas MVP.
- Las migraciones historicas del repo usan nombres con guiones y la CLI de Supabase las omite; las migraciones nuevas de release se dejaron con timestamp valido `YYYYMMDDHHMMSS_nombre.sql`.
- El slice `REQ-0012` todavia requiere smoke funcional con apps levantadas y migraciones aplicadas antes de tocar data real o promoverlo a un entorno con evento activo.
- Verificacion DNS del 2026-05-28: `babyclubaccess.com` responde con A y DKIM en `resend._domainkey`, pero no devolvio TXT SPF en root ni TXT `_dmarc`; eso puede seguir afectando entregabilidad en `icloud.com` y `outlook.com` fuera del codigo.
- El fix del dashboard depende de aplicar `20260528173000_fix_qr_summary_table_classification.sql` en cualquier entorno que ya tenga el RPC `get_qr_summary_all`; con solo deploy de app, ese entorno seguiria usando la clasificacion vieja.
- Backup pre-migracion 2026-05-28: el `pg_dump` directo del host `db.wtwnhqbbcocpnqqsybln.supabase.co` fallo por DNS; se genero snapshot alternativo via API del proyecto remoto (`public schema`, `public data`, `auth users`) en artefactos locales temporales antes de considerar cualquier migracion remota.
- El hotfix remoto del dashboard queda fuera del historial de migraciones aplicado por CLI; en la siguiente ventana de release hay que reconciliar `20260528173000` con el estado ya aplicado manualmente, ademas de revisar `20260527213000` y `20260528010000`.

## Siguiente paso recomendado

- Usar [REQ-0003-primer-lote-requerimientos-y-correcciones.md](./01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md) como intake del primer lote.
- Cuando aparezca un item concreto, clonarlo a un REQ individual desde [99-Templates/tpl-requirement.md](./99-Templates/tpl-requirement.md).
- REQ tecnico cerrado mas reciente: [REQ-0011-liquidaciones-promotores-ledger.md](./01-Requirements/REQ-0011-liquidaciones-promotores-ledger.md), actualizado con CRUD separado, reporte consolidado y migraciones remotas aplicadas.
- REQ tecnico cerrado mas reciente: [REQ-0012-catalogo-flexible-entradas-y-nominacion-posterior.md](./01-Requirements/REQ-0012-catalogo-flexible-entradas-y-nominacion-posterior.md), implementado en el worktree `req-0012-flexible-tickets` y validado con typecheck landing/backoffice mas suite focalizada de 25 tests.
- Si el requerimiento toca tenancy, contratos API, auth, pagos, logs o migraciones, abrir revison de arquitectura antes de codificar.
