# Mis entradas: DNI y dispositivos verificados

## Flujo de acceso

1. El cliente escribe su DNI (ocho dígitos, conservando ceros iniciales).
2. Si el dispositivo tiene una sesión vigente para ese DNI, ve sus QR sin otro correo. También puede volver a abrir `/mis-entradas` directamente, sin volver a escribir DNI.
3. En un dispositivo nuevo se envía un código de seis dígitos al correo ya registrado en su entrada o compra del evento más cercano. El cliente no puede elegir otro destinatario. La respuesta pública nunca confirma si el DNI existe ni muestra el correo.
4. El código vence en diez minutos, admite cinco intentos y solo funciona en el navegador que lo solicitó. Su consumo y la creación de sesión son atómicos en PostgreSQL.
5. El dispositivo puede recordarse durante treinta días. Si se desmarca la opción, la cookie dura la sesión del navegador y el registro vence a las doce horas. Cerrar acceso revoca esa sesión en el servidor.

Solo se muestra el evento más cercano entre los accesos propios. Se excluyen eventos eliminados, cerrados, inactivos o iniciados hace más de doce horas; la ventana permite conservar una noche en curso. Pausar ventas o agotar entradas no invalida entradas ya compradas. No se modifica la política del scanner.

El asistente solo obtiene entradas cuyo DNI y correo coinciden con su identidad verificada. La gestión de una mesa o compra solo aparece si coinciden los datos del comprador, nunca por compartir correo ni por el vínculo de una entrada a una reserva ajena. Si un DNI tiene distintos correos históricos, esta sesión queda limitada al correo del próximo acceso: no agrupa los demás sin verificación. Registros sin correo válido requieren atención de BABY.

Se reutiliza el QR existente y la misma evaluación de validez del ticket: usado, cancelado, vencido o pendiente no muestra QR. Se consulta `ticket_reservation_units` para respetar cancelaciones. La lectura admite hasta cien entradas y cien reservas futuras por identidad. El acceso mediante un enlace personal sigue disponible como opción secundaria.

## Seguridad y almacenamiento

- `GET/POST /api/customer-access`, respuestas `private, no-store`, cookies `HttpOnly`, `SameSite=Strict` y `Secure` bajo HTTPS. En producción la cookie usa el prefijo `__Host-`, sin Domain. Los POST exigen Origin del mismo host y puerto; HTTP se admite únicamente en loopback local.
- Token de sesión aleatorio de 256 bits; solo se almacena su SHA-256 en la base. DNI y correo se guardan cifrados con AES-256-GCM; hashes de DNI/IP/OTP usan HMAC-SHA256 con dominios separados. No hay DNI, QR ni credenciales en localStorage o URL.
- Tres solicitudes de código por DNI y hora, separación mínima de sesenta segundos y diez por IP y hora, aplicadas en PostgreSQL con bloqueo transaccional. Cinco fallos bloquean el desafío. Límite adicional en memoria de treinta POST por IP cada quince minutos.
- Tablas `customer_access_challenges` y `customer_access_devices` con RLS y sin permisos para anon/authenticated. RPC de creación, verificación y limpieza exclusivamente para service_role. No se cambian compras, pagos, entradas ni tokens QR existentes.
- La limpieza elimina registros vencidos hace más de un día al procesar nuevas solicitudes. No hay cron nuevo; si cesa el tráfico, la limpieza se ejecuta con la siguiente solicitud. Los logs omiten DNI, correo, código y enlaces.
- Correo transaccional mediante el transporte actual y clave de idempotencia por desafío. Si el proveedor falla, el cliente puede solicitar otro código después de sesenta segundos, sujeto al máximo de tres por hora; no hay reintento autónomo del correo.

## Prueba y despliegue

Migración nueva: `supabase/migrations/20261016140000_customer_ticket_access.sql`. Aplicada a Supabase local y, el 16 de octubre de 2026, a producción `wtwnhqbbcocpnqqsybln` en una transacción con registro en `supabase_migrations.schema_migrations`. Integridad de la migración y permisos de las dos tablas y tres funciones comprobados en producción. No se modificaron las tablas de compras, entradas, pagos ni QR existentes.

Configuración: `CUSTOMER_ACCESS_SECRET`, secreto aleatorio de 32 bytes codificado como 64 caracteres hexadecimales, solo servidor y excluido de Git. Producción tiene una clave independiente, guardada como Secret únicamente en Vercel `babyclub-landing/Production`. La clave provisional fue reemplazada antes del despliegue y antes de emitir sesiones. No reutilizar tokens de Mercado Pago ni la service_role como secreto.

Antes de un despliegue productivo: aplicar la migración aditiva, configurar un secreto productivo independiente en landing/Production, conservar el correo transaccional configurado y comprobar tablas/permisos antes de activar la nueva página. La ausencia de configuración falla cerrada. Rotar el secreto invalida las identidades cifradas y exige verificar de nuevo; no afecta QR ni cobros. Para revertir, restaurar el release anterior y conservar las tablas nuevas hasta terminar el período de reversión; no se deben borrar registros reales para probar.

Validación previa: 52 pruebas en siete archivos, compilación de landing y ensayo HTTP completo sobre PostgreSQL/Mailpit local, incluyendo decodificación del QR original, dispositivo recordado, límites y revocación. El smoke productivo utiliza solicitudes anónimas o inválidas, sin generar compras ni enviar códigos a clientes reales.

Validación local reproducible, con la app en `http://127.0.0.1:3004`:

```sh
node node_modules/vitest/vitest.mjs run apps/landing/lib/customerAccessCrypto.test.ts apps/landing/lib/customerTickets.test.ts apps/landing/app/api/customer-access/route.test.ts apps/landing/app/api/tickets/recover
node scripts/local/test-customer-access.mjs
```

El ensayo comprueba origen local y transporte Mailpit antes de crear datos ficticios. Valida DNI/código/QR, separación de eventos y titulares, decodificación del PNG contra el token QR existente, dispositivo nuevo y recordado, cierre, expiración, límites, consumo concurrente y permisos anon. Elimina solo los IDs de su ejecución; `--keep` conserva fixtures para QA visual y escribe sus datos ficticios en `.local/customer-access-qa.json` (no versionado). No debe usarse contra producción.

## Endpoint anterior por correo, conservado por compatibilidad

El formulario principal ya no llama al envío de enlaces por correo. Se conserva el endpoint anterior para clientes que tengan abierta una versión anterior de la página.

El endpoint `POST /api/tickets/recover` responde de forma uniforme, exista o no una compra, y consulta/envía después de responder mediante Next `after`. Nunca devuelve identificadores, datos del comprador ni QR al navegador.

- Entradas: coincidencia exacta sin distinguir mayúsculas del correo de la propia entrada; activa, sin eliminar, pago `paid` o sin pago legacy. No se obtiene el espacio de compra de otro titular a través de una entrada nominada.
- Compras y mesas: correo del comprador, reserva aprobada y sin eliminar.
- Se consulta solo eventos activos, sin eliminar ni cerrar, con inicio futuro o dentro de las últimas 12 horas para conservar la noche en curso. Entre los eventos con accesos del cliente se elige el más cercano y se incluyen hasta 20 enlaces de cada clase de ese único evento. Los eventos agotados o con venta pausada conservan los accesos adquiridos. Son los accesos existentes: no se reemiten ni cambian QR.
- Destino fijado al mismo correo buscado. Se escapan comodines de SQL LIKE y HTML.
- Cinco solicitudes por IP cada 15 minutos y una por destinatario cada 20 minutos, en memoria por instancia. La clave de idempotencia de Resend deduplica por destinatario y ventana de 20 minutos entre instancias. No es un contador distribuido estricto; una protección global más fuerte requeriría almacenamiento compartido o WAF.
- Los errores de entrega quedan registrados con un mensaje genérico sin correo ni enlaces. No hay una cola de reintento para este envío; el cliente puede volver a solicitarlo transcurrido el plazo.
- El correo usa el origen público configurado, nunca el Host de la solicitud. En local los enlaces apuntan al dominio público: para verificar la ruta con datos ficticios se reemplaza solo el origen por localhost.

Validación: pruebas unitarias de privacidad, destinatario, filtros, escape e idempotencia; envío HTTP real a Mailpit con compra ficticia y apertura local de enlaces de entrada y reserva (HTTP 200). Ningún envío a clientes reales y ninguna migración o escritura de datos productivos.

Contexto consultado: Obsidian `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md`; contrastado con el código actual. Se aplicó la skill `email-best-practices` a este correo transaccional.

## Corrección de clientes con historial (16 octubre 2026)

La búsqueda del correo de verificación prioriza el próximo evento y recurre al registro histórico más reciente del mismo DNI y tipo de documento, sin registros eliminados. La ausencia de entradas próximas no impide recibir el código. La cartera sigue mostrando únicamente el próximo evento; si no existe, no muestra QR pasados. Los logs distinguen destinatario ausente, límite, correo aceptado y etapa del fallo sin datos personales. El ensayo local verifica el envío a Mailpit y la cartera vacía para clientes con historial exclusivamente pasado.
