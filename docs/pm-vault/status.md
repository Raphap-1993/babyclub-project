---
type: status
project: babyclub-monorepo
status: active
owner: Patroclo
updated: 2026-05-30
last_reviewed: 2026-05-30
---

# Status

## 2026-05-30 - Reenvio selectivo de nominaciones

- Se ejecuto reenvio selectivo para `BABY RAVE | ABYSS` solo sobre reservas `ticket-only` aprobadas con unidades pendientes de nominacion.
- Resultado: `33` reservas revisadas, `26` candidatas, `25` correos enviados, `0` fallas de proveedor, `1` email invalido corregido y reenviado aparte.
- El motivo de las `23` emisiones previas al envio fue operativo, no nuevo bug: eran reservas ya `approved` cuya `unidad 1` seguia `pending_nomination` y sin `ticket_id`, asi que el QR del comprador se emitio antes de mandar el correo.
- Decision: no se necesita un segundo blast masivo, porque esas personas ya recibieron el correo actualizado con QR del comprador y CTA `Completar asistentes`.

## 2026-05-30 - Cierre operativo evento

- `master` queda publicado con el paquete operativo del evento: nominaciones publicas, scanner de puerta, dashboard comercial y modal de lotes por tipo.
- Nominaciones: links de correo corregidos al dominio publico; UI publica minima y responsive; lookup por DNI con boton unico; popup para exito/error; `Ver ticket` y reenvio desde la misma vista; reemision de nominados emitidos compatible con el esquema legacy.
- Emision: se corrige el lookup del documento del comprador en `unidad 1`, con lo que guardar nominaciones + emitir QR deja de fallar por datos incompletos del comprador.
- Puerta: `scan` y `scan/confirm` ya bloquean mismatch de evento, tickets inactivos o `pending`, consumen el mismo ticket de forma mas segura y marcan la unidad como `used`.
- Dashboard: `Entradas` ya refleja unidades vendidas reales (`sale_origin='ticket'`), mientras `QR emitidos` sigue siendo el total emitido; `Mesas`, `Cortesias` y `Free` quedan alineados a buckets comerciales.
- Lotes: el modal de generacion ya respeta el `Tipo` seleccionado y la politica por tipo; el label visible queda simplemente como `Cortesia`.
- Verificacion consolidada: suites focalizadas de `publicUrl`, `ticket-reservations issue/units`, `nominationLookup`, `scan`, `qr-summary`, `dashboardModel`, `codeBatchPolicy` y `codes batches generate` pasan; `tsc` de `landing` y `backoffice` pasa.

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
- `REQ-0012` ya quedo promovido a `master` con el flujo buyer-first: el comprador es el primer asistente, recibe su QR inmediato y la UI publica ahora pide `Completar asistentes` solo para los cupos restantes.
- Backoffice promotores: la creacion ya rehidrata promotores archivados para la misma persona/organizer y evita duplicados activos al reintentar el alta.
- Backoffice promotores: el estado operativo ya se maneja como `activo/inactivo` visible; el listado permite desactivar/reactivar sin archivar y los promotores inactivos ya no pueden generar códigos ni links nuevos.
- Tickets admin: la lista `/admin/tickets` ya deduplica reemisiones antiguas por `code_id` y solo muestra el ticket activo mas reciente por QR.
- Cortesias por lote: `REQ-0015` ya quedo implementado con politica por tipo, validacion de expiracion y cierre autoritativo por cupos/expiracion en el listado.
- Landing mesas: `registro` y `compra` ya enfocan el grupo real de mesas al abrir el croquis, evitando que se vean demasiado pequeñas en desktop/mobile.
- Scanner y QR de mesa/box: cada codigo de una misma reserva ya puede emitir tickets independientes aunque repita comprador, el scanner no los bloquea por DNI duplicado y ahora muestra el tipo comercial en paneles de color mas evidentes.
- Correos de tickets: el endpoint publico `/api/tickets/email` ya usa el sender compartido con `process_logs`, no devuelve exito falso si Resend responde error y normaliza dominios de destinatario antes de enviar.
- Captura y reenvio de correos: landing, nominacion ticket-only y backoffice ya rechazan emails mal formados antes de persistir o reenviar, para que un dato roto no termine en Resend como falso problema de proveedor.
- Dashboard tickets: el resumen QR ya solo clasifica `mesa` cuando el ticket tiene `table_id`; las compras ticket-only dejan de inflar la cuenta/composicion de mesas en home.
- Ticket publico: la vista `/ticket/[id]` ya separa `Mesa / Box`, `QR promotor`, `QR cortesia`, `QR libre`, `QR general` y `ticket-only` con copy/tonos distintos; deja de usar el bloque ambiguo `QR de mesa / promotor`.
- Dashboard QR remoto: el RPC `public.get_qr_summary_all` ya fue aplicado puntualmente en `babyclub-access` via `supabase db query --linked -f supabase/manual/2026-05-28-hotfix-get_qr_summary_all.sql`, sin empujar las otras migraciones pendientes del branch.
- Dashboard tickets: el resumen ahora trata `sale_origin='ticket' + codes.type='courtesy'` como `general` para métricas, corrigiendo las `37` entradas pagadas de `BABY RAVE | ABYSS` que el schema legacy obligaba a guardar con tipo técnico `courtesy`.
- Dashboard comercial: para `BABY RAVE | ABYSS` se dejo evidenciado que `QR emitidos` (`196`) y `Entradas` vendidas reales (`59`) no son la misma metrica; el home ya no mezcla ambas cifras.
- Scanner de puerta: el contrato operativo sigue amarrado a tipos canonicos `courtesy/promoter/table/general/free`; cambios de label visual o del dashboard no modifican puerta, pero cualquier `code.type` nuevo debe incorporarse explicitamente.
- Codes/lotes: la politica `expiracion obligatoria por codigo` solo decide si el tipo exige fecha manual al crear lotes; no redefine clasificaciones comerciales ni scanner.
- Landing compra: el selector de `Evento` ya vive arriba del flujo publico en `Solo entrada` y `Reserva mesa`, mientras `Compra segura y validada por BABY` baja al tramo legal junto a la aceptacion final.
- Landing compra: si hay multiples eventos activos, `/compra` ya no autoselecciona el primero por fecha ni muestra su lote/precio como default; solo autoselecciona cuando existe exactamente un evento habilitado.
- Landing compra/registro: `Bugfix 09` ya corrige copy de estados vacios, compacta el bloque legal final y reintroduce branding BABY consistente en `/registro` usando `logoUrl` cuando existe.
- Backoffice reservas: aprobacion y reenvio de mesas ya respetan la cantidad snapshot guardada en la reserva y no sobreemiten tickets si la mesa o el pack fueron editados despues.
- Backoffice tickets: la lista y el detalle ya muestran badge operativo para `Entrada comprada`, `QR libre`, `QR cortesia`, `QR promotor` y `Mesa / Box`, usando `sale_origin` + `ticket_type_label` para no confundir compras pagadas legacy con `courtesy`.
- QR free: la liberacion comercial queda explicitamente bloqueada por defecto con `ENABLE_FREE_QR_CODES`; hoy no existe generacion por lotes en backoffice ni data `codes.type='free'` en la clonacion local, asi que `REQ-0009` sigue pendiente como feature real.

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
- Lectura operativa 2026-05-28: `process_logs` remoto no muestra una falla sistemica por `icloud/outlook`; el error reciente observado fue un email mal formado sin TLD. La reputacion/DNS sigue siendo riesgo externo, pero el bug de captura ya queda acotado por aplicacion.
- El fix del dashboard depende de aplicar `20260528173000_fix_qr_summary_table_classification.sql` en cualquier entorno que ya tenga el RPC `get_qr_summary_all`; con solo deploy de app, ese entorno seguiria usando la clasificacion vieja.
- Backup pre-migracion 2026-05-28: el `pg_dump` directo del host `db.wtwnhqbbcocpnqqsybln.supabase.co` fallo por DNS; se genero snapshot alternativo via API del proyecto remoto (`public schema`, `public data`, `auth users`) en artefactos locales temporales antes de considerar cualquier migracion remota.
- El hotfix remoto del dashboard queda fuera del historial de migraciones aplicado por CLI; en la siguiente ventana de release hay que reconciliar `20260528173000` con el estado ya aplicado manualmente, ademas de revisar `20260527213000` y `20260528010000`.
- El schema remoto todavía conserva la restriccion `codes_one_general_per_event`; por eso la correccion del bug de resumen vive en la funcion SQL y en el fallback de app, no en una mutacion masiva de `codes.type`.

## Cierre diario 2026-05-29

- Se cerró el ruido de reemisiones antiguas en tickets: la edición de un nominado emitido ya no crea filas nuevas en `tickets`, sino que reemite sobre el mismo `ticket_id`.
- Se ocultaron reemisiones antiguas en `/admin/tickets` deduplicando por `code_id`, para que el backoffice no confunda reemisiones con ventas nuevas.
- Se forzó un redeploy limpio de `landing` y `backoffice` con el commit vacío `968e0ec` para refrescar Vercel sin tocar lógica.
- Estado de hoy: `landing` y `backoffice` quedaron con deploy `pending` en Vercel para el último push, y el trabajo de hoy quedó documentado aquí y en Obsidian.

## Siguiente paso recomendado

- Usar [REQ-0003-primer-lote-requerimientos-y-correcciones.md](./01-Requirements/REQ-0003-primer-lote-requerimientos-y-correcciones.md) como intake del primer lote.
- Cuando aparezca un item concreto, clonarlo a un REQ individual desde [99-Templates/tpl-requirement.md](./99-Templates/tpl-requirement.md).
- REQ tecnico cerrado mas reciente: [REQ-0011-liquidaciones-promotores-ledger.md](./01-Requirements/REQ-0011-liquidaciones-promotores-ledger.md), actualizado con CRUD separado, reporte consolidado y migraciones remotas aplicadas.
- REQ tecnico cerrado mas reciente: [REQ-0012-catalogo-flexible-entradas-y-nominacion-posterior.md](./01-Requirements/REQ-0012-catalogo-flexible-entradas-y-nominacion-posterior.md), implementado en el worktree `req-0012-flexible-tickets`, promovido a `master` con buyer-first nomination y validado con typecheck landing/backoffice mas suite focalizada de 25 tests.
- REQ tecnico cerrado mas reciente: [REQ-0013-pulidos-visuales-compra-registro-estados-vacios.md](./01-Requirements/REQ-0013-pulidos-visuales-compra-registro-estados-vacios.md), validado con suite focalizada de landing, `pnpm typecheck:landing` y smoke DOM local en `/compra` y `/registro`.
- REQ tecnico cerrado mas reciente: [REQ-0014-estado-operativo-promotores-y-bloqueo-de-codigos.md](./01-Requirements/REQ-0014-estado-operativo-promotores-y-bloqueo-de-codigos.md), validado con suite focalizada de promotores, `pnpm typecheck:backoffice` y `git diff --check`.
- Si el requerimiento toca tenancy, contratos API, auth, pagos, logs o migraciones, abrir revison de arquitectura antes de codificar.

## Hotfix 2026-05-30 17:25 America/Lima - Unicidad QR por evento

- Regla vigente: una persona puede tener QRs para eventos distintos, pero solo `1 QR activo por evento`.
- El guard ya cruza `person_id`, `documento`, `nombre+email` y `nombre+telefono` dentro del mismo `event_id`.
- El cambio aplica en registro publico, ticket-only, aprobacion/reenvio de reservas, alta manual admin y scanner de puerta.
- Produccion: se archivo el ticket general incorrecto del caso reportado y se dejo activo solo el QR correcto.
- Commit publicado: `23f2efb` `Enforce one QR per person per event`.

## Hotfix 2026-05-31 00:35 America/Lima - Ticket-only bloquea duplicado antes de crear reserva

- La compra publica de entrada ya no deja crear una reserva `pending` si el comprador ya tiene un QR activo para ese evento.
- El pre-check `/api/check-ticket-reservation` ya mira `tickets` activos del evento y `/compra` corta el flujo `Solo entrada` antes del resumen si encuentra conflicto.
- Commit publicado: `b60489a` `Block duplicate event QR at reservation creation`.
