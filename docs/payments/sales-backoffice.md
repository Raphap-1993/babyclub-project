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

El formulario muestra el QR emitido en el detalle del comprador. El correo se puede enviar con la acción existente «Reenviar correo»; el nuevo endpoint de registro no envía correos ni repite un cobro.

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
