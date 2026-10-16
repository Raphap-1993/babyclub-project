# Ventas, pagos e invitaciones en backoffice

## Hallazgos y resultado esperado

Revisión del 16 de octubre de 2026. Mercado Pago ya acredita el pago canónico en `payments`, aprueba la reserva y hace que el trigger de tickets asigne `payment_status='paid'`. Sin embargo, el backoffice solo mostraba «Aprobada» y no cargaba la evidencia de pago. El formulario manual activo solo admitía mesas y llamaba al endpoint legacy de reservas, que podía emitir un ticket sin estado de pago.

La aprobación operativa de una reserva y el pago recibido son estados distintos. Los registros históricos aprobados sin recibo no se convierten automáticamente en pagados.

## Flujo online

1. Selección y datos crean una reserva pendiente y una sesión de checkout.
2. Un intento pendiente, fallido o un desafío 3DS no emite QR.
3. El webhook firmado consulta la orden canónica y valida cuenta, aplicación, moneda e importe. Solo una aprobación acreditada registra el recibo pagado y aprueba la reserva.
4. Fulfillment emite una vez el QR del comprador y prepara las unidades de acompañantes pendientes de nominación. Los QR emitidos después de nominarlos también heredan el pago.
5. Reservas muestra el recibo y su fuente; Tickets muestra «Pagada» separado del tipo comercial. Devoluciones mantienen su flujo por Mercado Pago; no se confirma un pago online con un botón de aprobación manual.

## Venta manual de un cobro ya recibido

Acceso: Reservas → Registrar venta manual. Solo administradores y superadministradores pueden enviar la operación. Se selecciona evento, entrada y paquetes, o mesa/box y pack disponible. Se requiere comprador, documento válido, email, medio del cobro, confirmación explícita del importe recibido y referencia para medios distintos de efectivo. El importe se obtiene de la configuración, no de un precio libre.

`record_manual_sale` realiza una transacción: valida personal activo, precio vigente, capacidad, disponibilidad, comprador, referencia e idempotencia; crea reserva aprobada, recibo `provider='manual'`, códigos internos, unidades y QR pagado del comprador. Guarda usuario, medio y referencia en la metadata del recibo. No hace un cargo en Mercado Pago. No convierte una invitación existente ni reemplaza un QR anterior.

El bloqueo de inventario es el mismo que usa la reserva online. No permite vender el mismo box dos veces, duplicar una referencia de cobro ni abrir otra compra online para un comprador con una venta manual activa. También bloquea una venta manual mientras ese comprador tiene un checkout online activo. La misma solicitud puede reintentarse sin generar otra venta. Cambiar sus datos con la misma clave produce conflicto.

El trigger `manual_ticket_guard` propaga el estado pagado a los QR posteriores de la reserva. Desactivar o archivar una entrada no implica devolver dinero; los recibos permanecen como evidencia. Las devoluciones de cobros externos requieren la operación financiera correspondiente, fuera del registro manual.

El formulario muestra el QR emitido en el detalle del comprador y el resultado del envío automático. La venta registra un trabajo privado en `manual_sale_email_jobs` dentro de la misma transacción del recibo. Después del commit se envía una confirmación con el QR del comprador adjunto e integrado mediante CID, importe y comprobante, enlace al ticket y acceso a completar acompañantes. No se cobran importes adicionales ni se crean QR al notificar.

La clave de idempotencia del proveedor es `manual-sale-<payment_id>`. La cola usa un bloqueo de dos minutos y token de propietario; los fallos no revierten una venta pagada. El proceso protegido de recuperación de la landing reintenta hasta diez veces dentro de 23 horas. Después queda `failed` para revisión y reenvío explícito. `sent` acredita aceptación del proveedor, no entrega en la bandeja del destinatario. No hay backfill masivo de ventas históricas.

Validación del correo: `BABY_MANUAL_EMAIL_LOCAL_TESTS=1` con `packages/shared/email/manualSale.local.test.ts`, únicamente Supabase loopback y Mailpit. Comprueba entradas y box, reserva aprobada, recibo y ticket pagados, recepción local, decodificación del PNG contra `tickets.qr_token`, concurrencia, reintento y bloqueo del acceso público.

## Separación comercial

- Tickets / QR tiene filtros «Todas», «Compras: entradas y boxes» e «Invitaciones por código». Se aplican antes de paginar y también a la exportación.
- El origen de compra se determina por la relación con la reserva o la evidencia de pago, no por `codes.type` aislado. Los códigos internos de una compra pueden ser técnicamente `courtesy`; eso no convierte la venta en una cortesía comercial.
- Las invitaciones sin reserva ni pago conservan «Código de invitación» y no reciben etiqueta de pagadas.
- La cantidad comprada y la cantidad de QR ya nominados siguen siendo magnitudes diferentes. No se crean identidades ficticias para emitir todos los QR de un pack.

## Validación y despliegue

Migración aditiva: `20261016170000_manual_sales.sql`. No actualiza compras históricas ni sustituye tokens QR existentes. Funciones revocadas para public/anon/authenticated; solo el servidor ejecuta la venta y vuelve a validar el administrador.

Pruebas locales: 49 tests del backoffice y clasificación; 11 de Mercado Pago sobre Supabase local, incluyendo acreditación de entradas y boxes, 3DS, webhook, idempotencia y devolución. `scripts/local/test-manual-sales.mjs` comprueba transacción real, concurrencia, referencias, modificación del precio, capacidad, aislamiento entre checkout online y manual, QR posteriores pagados e invitaciones sin pago. El script exige loopback y elimina exclusivamente sus fixtures.

QA desde UI autenticada local: registro de un pack de dos entradas y un box de ocho accesos, recibos de S/75 y S/600, QR del comprador emitidos, filas «Pagada · Venta manual» y filtros que excluyen una invitación sintética. No se hicieron cargos reales ni pruebas con registros productivos.

Orden de release: revisar contrato de esquema y aplicar la migración en una transacción, registrar su versión e integridad y luego desplegar el código. Verificar RPC restringida, nuevas páginas y pagos actuales sin crear ventas productivas de prueba. Para revertir la interfaz, conservar la migración y los recibos: las ventas manuales ya registradas necesitan mantener su clasificación y guardas de nominación.

Contexto: Obsidian `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md`, `06 Requirements.md`. Notas históricas contrastadas con repositorio y PostgreSQL local.

Release productivo: migración 20261016170000 aplicada el 16 de octubre de 2026 en wtwnhqbbcocpnqqsybln, con registro y hash exacto del archivo normalizado a LF. Cuerpos de las tres funciones comparados con el archivo local y permisos verificados: anon/authenticated no ejecutan la venta, service_role sí. Cero recibos manuales productivos creados durante la validación. La primera ejecución detectó un delimitador SQL incorrecto y fue rechazada sin aplicar la migración; el archivo completo corregido se validó en PostgreSQL local antes de instalarse.

Cierre de acceso: reservas, tickets y detalle ya no serializan registros privados en HTML/Flight. El servidor entrega una vista vacía y carga datos mediante `GET /api/admin/sales-view` con verificación de personal activo y `private, no-store`. Prueba HTTP local sobre seis respuestas HTML/Flight y tres vistas API anónimas, además de comprobación UI con sesión. QR del detalle y modal generados como PNG en el servidor con `shared/ticketQr`, sin transmitir tokens a un generador externo. Esta corrección cubre las pantallas de este slice; no constituye una auditoría de todas las pantallas históricas del backoffice.
# Corrección de roles de ventas manuales (2026-10-16)

El intento de las 13:03 falló con `manual_sale_forbidden`: producción usa
`staff_roles.code='ADMIN'`, pero la función SQL comparaba con `admin` sin
normalizar, a diferencia del guard de la API. La migración
`20261016190000_manual_sales_role_case` aplica `lower(r.code)` manteniendo
los mismos roles permitidos, el requisito de usuario activo y no archivado.
No se cambian roles de usuarios ni se registran ventas para probar en producción.

La regresión local reproduce primero el fallo con `ADMIN` y después verifica
entradas y boxes, recibo y QR pagados, concurrencia e idempotencia. `DOOR`
continúa rechazado. El rol del fixture local se restaura al finalizar.
El rechazo de permisos ahora devuelve 403 con un mensaje específico.

