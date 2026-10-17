# Mercado Pago en producción — BabyClub

## Alcance y destinos

Estado 2026-10-15: Mercado Pago habilitado en modo `live` en
`babyclubaccess.com`. Cuenta real de Perú validada mediante `/users/me`,
credenciales exclusivas de Vercel/Production y webhook productivo configurado.
Supabase Cron ejecuta la recuperación cada minuto usando una clave dedicada en
Vault; las primeras ejecuciones devolvieron HTTP 200, sin errores ni trabajos
pendientes. Las migraciones y el respaldo privado están verificados; no se
crearon compras ficticias ni se efectuaron cobros reales durante la activación.

Entradas, mesas y boxes admiten tarjeta o Yape. Yape permite S/ 1 a S/ 2,000 por operación y el comprador puede tener un límite menor en su aplicación. Los importes fuera del intervalo se pagan con tarjeta.

Mejora de aprobación (2026-10-16): el checkout obtiene `MP_DEVICE_SESSION_ID`
generado por MercadoPago.js y lo pasa transitoriamente al servidor. Al crear
Orders de tarjeta o Yape se envía mediante `X-meli-session-id`. Se valida su
formato y longitud y no se persiste ni se agrega al cuerpo de la Order.
Si el SDK aún no lo generó, se espera hasta dos segundos; si no está disponible,
se conserva el pago sin inventar un identificador. No se duplica el script de
seguridad que ya incluye el SDK.

Los rechazos `high_risk` y `cc_rejected_high_risk` ahora advierten que se eviten
intentos seguidos y ofrecen otro medio o consulta con Mercado Pago. Los motivos
`3ds_challenge_failed` y `cc_rejected_3ds_challenge` explican la validación del
banco sin desactivar 3DS ni dar por aprobado un rechazo. Esto mejora las señales
de evaluación, pero no garantiza que Mercado Pago apruebe cada operación.

Fuente: https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-management/improve-payment-approval/recommendations
Memoria contrastada: `20_Projects/babyclub-monorepo/00 Context.md`,
`01 Status.md`, `02 Decisions.md`; el código y la auditoría de solo lectura
del 16 de octubre prevalecen sobre el estado histórico del vault.
Se usa Orders API, campos alojados de tarjeta, validación 3DS cuando corresponde,
webhook firmado y emisión idempotente. El comprador recibe su QR al acreditarse
el pago; los acompañantes reciben QR individuales al completar su nominación.
No se convierten reservas históricas a Mercado Pago ni se regeneran sus QR.

- Dominio: `https://babyclubaccess.com`.
- Vercel: `babyclub-landing`, rama `master` de `Raphap-1993/babyclub-project`.
- Supabase: `wtwnhqbbcocpnqqsybln`.
- Aplicación real: `2226437819713`. Nunca usar la aplicación sandbox `6682958408134086`.
- Webhook: `POST https://babyclubaccess.com/api/payments/mercadopago/webhook`.
- Recuperación: `POST /api/payments/mercadopago/reconcile`, autenticación Bearer independiente.

## Configuración exclusiva de Production en Vercel

Secrets: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`,
`MERCADOPAGO_WORKER_SECRET`. No guardarlos en Git, capturas ni documentación.

Config:

```dotenv
MERCADOPAGO_ENVIRONMENT=live
MERCADOPAGO_APPLICATION_ID=2226437819713
MERCADOPAGO_COLLECTOR_ID=<vendedor real validado con /users/me>
MERCADOPAGO_PUBLIC_KEY=<Public Key productiva>
MERCADOPAGO_PRODUCTION_SUPABASE_URL=https://wtwnhqbbcocpnqqsybln.supabase.co
MERCADOPAGO_PRODUCTION_ORIGIN=https://babyclubaccess.com
NEXT_PUBLIC_APP_URL=https://babyclubaccess.com
ENABLE_MERCADOPAGO_PAYMENTS=true
```

Conservar las credenciales existentes de Supabase y Resend. `VERCEL_ENV` debe
ser la variable de sistema `production`. Live exige dominio HTTPS, proyecto
Supabase explícito, correo real y ambas firmas configuradas. Preview y localhost
rechazan cobros live. Sandbox continúa restringido a la base local.

## Base de datos y conservación de clientes

Preflight 2026-10-15: 533 reservas, 3290 tickets, 2983 códigos, 434 unidades y
14 pagos históricos (Culqi). No había tablas `mp_*`.

`node scripts/local/prepare-mp-production-sql.mjs` genera
`.local/mp-production-release.sql`; no conecta ni ejecuta SQL. El script:

1. Abre una transacción con espera de bloqueo máxima de 5 segundos.
2. Crea un respaldo privado `backup_mp_20261015` en el mismo servidor; acceso
   revocado a public/anon/authenticated/service_role y RLS habilitado.
3. Aplica exclusivamente `20261015210000`, `20261015223000` y `20261016001000`.
4. Compara cada fila anterior con su respaldo, excluyendo solo columnas nuevas.
   Cualquier diferencia aborta todo el cambio.
5. Registra las migraciones y refresca el esquema de PostgREST.

Las dos primeras migraciones agregan checkout y 3DS. La tercera restringe
`payments`, `payment_webhook_events` y `ticket_reservation_units` al servidor.
Las rutas y reportes actuales usan service_role; no necesitan acceso directo
desde anon/authenticated. El respaldo conserva también restricciones, permisos
y políticas previas. No es un reemplazo de un backup externo/PITR del proyecto.

## Activación y comprobación

1. Validar cuenta real, aplicación y país mediante lectura de API; no por prefijo
   del token: las cuentas sandbox también usan `APP_USR`.
2. Registrar en Mercado Pago la URL estable en **Modo de producción**, tema
   **Order (Mercado Pago)**. Usar su firma real, no la de la aplicación sandbox.
3. Configurar recuperación cada minuto con Supabase Cron + pg_net y una clave
   dedicada en Vault. Verificar respuesta HTTP 200, no solo éxito de la tarea SQL.
4. Desplegar con ventas deshabilitadas; comprobar webhook, permisos, acceso sin
   token rechazado y páginas públicas. Activar la bandera solo con configuración completa.
5. Verificar ambos formularios de compra. Un cobro real de aceptación lo realiza
   el titular con importe y evento acordados. No insertar compradores ficticios
   en producción ni declarar probado un cobro real sin evidencia.

Comprobación del despliegue de activación `E9Z8xNo8U2UexkoMofksZVmCacAr`
(código `841b016`, estado Ready):

- `/api/payments/status`: Mercado Pago `enabled: true`, `environment: live`;
  Culqi continúa deshabilitado.
- Worker sin credencial: HTTP 401. Con la credencial dedicada: HTTP 200,
  `checked: 0`, `errors: 0`, `notificationJobs: 0`.
- Webhook de tipo Order sin firma: HTTP 401 `webhook_signature_invalid`, sin
  insertar un evento. No se enviaron órdenes inventadas al simulador productivo.
- `baby-mp-reconcile` activo con frecuencia `* * * * *`; ejecuciones SQL
  exitosas y respuestas HTTP 200 verificadas en `net._http_response`.
- Conteos posteriores: 533 reservas, 3290 tickets, 2983 códigos, 434 unidades,
  14 pagos históricos; 0 sesiones, intentos, eventos y notificaciones de MP.
- UI pública: entrada individual y reserva de mesa avanzan a Datos con el texto
  de Mercado Pago. El croquis conserva la disponibilidad real; se revisó el
  paquete BOX 1 de S/ 600 para 8 personas sin ingresar datos ni crear una reserva.

La emisión de QR, las notificaciones automáticas, la idempotencia y 3DS fueron
probados de extremo a extremo en sandbox. La primera compra real de aceptación
sigue pendiente del titular: debe comprobar aprobación en Mercado Pago, QR
válido y correo para una entrada y una mesa. No confundir configuración live
verificada con un cobro productivo de extremo a extremo ya realizado.

La firma usa `data.id` en minúsculas para el HMAC. La consulta y el cuerpo deben
coincidir exactamente; el ID original se conserva para la consulta canónica.
Ni `live_mode` del cuerpo ni el retorno del navegador acreditan una compra.

## Recuperación y reversión

- Usar **Sistema → Mercado Pago → Pausar ventas** para detener nuevas compras
  inmediatamente, sin redesplegar. Mantener credenciales, webhook y recuperación
  para liquidar intentos pendientes. La bandera de Vercel controla la integración;
  no sustituye la pausa operativa del panel.
- No eliminar las tablas `mp_*`, QR o reservas al revertir frontend. El historial
  de cobros permanece y las órdenes ambiguas se consultan, nunca se vuelven a cobrar.
- Los reembolsos completos confirmados por API desactivan los QR de esa compra.
  La gestión de reembolso de Mercado Pago se hace en su panel; la API legacy del
  backoffice continúa siendo de Culqi.
- Revisar sesiones `review`/`paid`, eventos `error` y notificaciones `error`.
  No resolver manualmente como pagado sin consultar la orden canónica.

## Panel de administración de Mercado Pago

Ruta del backoffice: `/admin/mercadopago`, también accesible desde Integraciones.
Solo personal activo con rol `admin` o `superadmin` puede consultar o cambiar
el control. El panel muestra el entorno del deployment y consulta la disponibilidad
real de la landing sin copiar credenciales de Mercado Pago al backoffice.

La migración `20261016013000_mercadopago_sales_control.sql` agrega un control
privado, inicialmente sin pausa, y un historial de cambios. No modifica registros
históricos. La pausa bloquea nuevas reservas online y nuevos intentos de cobro
en la base de datos. Los intentos ya enviados, 3DS pendiente, webhooks, recuperación,
nominación y QR existentes continúan. Reanudar requiere la confirmación del
administrador en el panel; cada cambio guarda fecha, staff y versión. Los cambios
con una versión desactualizada se rechazan para evitar sobrescrituras simultáneas.
No se conceden permisos directos de escritura en esas tablas, ni acceso a anon
o authenticated; la escritura se realiza mediante la RPC auditada del servidor.

**Pruebas** abre `http://127.0.0.1:3004/` y el panel local en
`http://127.0.0.1:3000/admin/mercadopago`. Requiere Docker, landing y backoffice
locales encendidos, además de la sesión administrativa local independiente.
Cada enlace apunta a la computadora que lo abre. No cambia credenciales, modo
ni datos del deployment productivo. Preview y una laptop conectada a la base
real no pueden usar este panel para modificar ventas.

Validación local del panel: autorización y entradas manipuladas; aislamiento de
entornos; dos administradores concurrentes; pausa de entradas y mesas; bloqueo
de un intento nuevo; acreditación y QR únicos de compras iniciadas antes de la
pausa; reanudación y auditoría. No probar la pausa con clientes en producción.

Publicación del panel, 2026-10-15: migración aplicada con aislamiento repeatable
read y comparación de checksums de todas las filas de nueve tablas de reservas,
QR y pagos antes/después. Datos existentes intactos; `paused=false`, historial
vacío y escritura directa denegada a service_role. Validación: 101 pruebas y
builds de landing/backoffice correctos. Pausa y reanudación comprobadas desde
el navegador únicamente en la base local.

## Evidencia y fuentes

### Publicación de Yape para entradas — 2026-10-15

La integración validada en `f61270a` y `cf77a15` se publica mediante `master`.
La cuenta productiva peruana se comprobó de nuevo con `/users/me`: vendedor
esperado, sin etiqueta `test_user`; `/v1/payment_methods` devolvió Yape activo.
El endpoint público confirmó `live`, ventas habilitadas, control de ventas
disponible y Public Key correspondiente a las credenciales productivas.

La regla se aplica tanto en la interfaz como en el servidor: solo una reserva
de entradas (`sale_origin=ticket`, sin `table_id`) puede pagar con Yape. Una
solicitud manipulada para una mesa o box se rechaza antes de crear un intento.
Tarjetas conservan los campos seguros y 3DS. No se agregan migraciones,
permisos, llaves o cambios en datos históricos; tampoco se copia la base local.

Se conserva el webhook productivo de la aplicación real y el worker existente.
Los webhooks verifican la firma y consultan la Order canónica antes de emitir.
El QR del comprador se emite al acreditar; cada acompañante obtiene su QR al
completar la nominación. La pausa del backoffice también bloquea intentos nuevos
de Yape y mantiene la conciliación de compras anteriores.

Validación previa: 134 pruebas, comprobación de tipos y build de landing;
webhooks espontáneos de Yape para dos compras aprobadas y una rechazada, con
worker detenido y páginas cerradas. Tres QR distintos decodificados, cinco
reenvíos sin duplicados, firma alterada rechazada y correos capturados en
Mailpit. Evidencia y procedimiento en `mercadopago-yape.md`.

La comprobación productiva se limita a disponibilidad pública, artefactos del
despliegue y guardas de acceso. No crear compras sintéticas, usar teléfonos de
prueba, nominar personas ficticias o hacer cobros desde el agente en producción.
La primera compra real de aceptación de Yape queda a cargo del titular; no
confundir la prueba sandbox con un movimiento de dinero real.

Sandbox: pruebas reales de 3DS y webhook automático para entrada y mesa,
duplicados en paralelo, firmas alteradas rechazadas y PNG de QR decodificados.
Detalle en `mercadopago-local.md`. Validación del paso a live: 73 pruebas,
typecheck y build de landing/backoffice; ensayo SQL con rollback y comparación
de registros históricos. El cobro live todavía requiere aceptación del titular.

- [Mercado Pago: salir a producción](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/go-to-production)
- [Notificaciones Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/notifications)
- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
- [Vault y llamadas programadas](https://supabase.com/docs/guides/functions/schedule-functions)

## Auditoría de tarjetas Perú — 17 octubre 2026

Revisión de `GET /v1/payments/search` de la cuenta real, intervalo del 16 de octubre
(hora de Lima), al corte 17/10 00:55: 10 pagos, dos Yape acreditados, siete Yape
rechazados `cc_rejected_high_risk` y una tarjeta Visa débito rechazada
`cc_rejected_3ds_challenge`. La Order de esa tarjeta confirma
`transactions.payments[0].status_detail=3ds_challenge_failed`, sin autorización.
La reserva no tiene QR emitido. Son motivos del proveedor; no prueban por sí
solos un error del webhook ni permiten atribuir el rechazo a un campo omitido.
La consulta fue de solo lectura, sin reintentos ni cargos sobre compradores reales.

Se sustituye el formulario manual de Core Methods por **Card Payment Brick**,
recomendado por la documentación peruana de Checkout API Orders. El SDK resuelve
marca, tipo crédito/débito, emisor y validaciones del país. La integración anterior
seleccionaba el primer resultado de `getPaymentMethods` y no utilizaba el flujo
completo del formulario oficial. Se conserva un solo pago, en una cuota, y los
colores BABY mediante variables oficiales del Brick, sin selectores CSS internos.

El adaptador permite únicamente token, método, tipo, cuotas y pagador. El documento
del titular que entrega el SDK llega ahora a `payer.identification` de Orders;
antes se descartaba entre formulario y servidor. No se sustituye por el DNI del
comprador, porque puede pagar otra persona. El servidor normaliza C.E a CE y valida
antes de crear el intento. Importe, reserva e idempotencia siguen viniendo del
servidor; PAN, CVV y datos adicionales arbitrarios no se envían a las APIs de BABY.

Se conserva 3DS `on_fraud_risk` con `liability_shift=required`, el device session
transitorio, webhook con firma obligatoria, lectura canónica y emisión idempotente.
Un rechazo bancario o antifraude puede seguir ocurriendo. No desactivar 3DS,
fabricar datos del titular ni reintentar automáticamente para intentar eludirlo.
Para `high_risk` reiterado, el titular de BABY debe solicitar revisión a Mercado
Pago con las referencias de operación; el proveedor no devuelve su modelo de riesgo.

Validación: 56 pruebas unitarias/API y 12 con Supabase local, tipos y build de
landing. Pruebas interactivas reales de sandbox mediante el Brick: Mastercard
aprobada; Visa con desafío 3DS aprobado; Mastercard débito con autenticación
rechazada y cero QR. El ensayo de box S/600 comprueba también la recuperación del
desafío al recargar y la emisión después de la aprobación. Los ensayos son del
vendedor ficticio, con base en loopback y correo capturado en Mailpit. El webhook
se verifica con eventos firmados en la suite local; estos ensayos de navegador
confirman por consulta canónica, sin afirmar una entrega espontánea de webhook.

Fuentes contrastadas:

- [Tarjetas / Orders Perú](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-integration/websites/cards).
- [3DS / Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-management/integrate-3ds).
- [Comportamiento del Card Payment](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/additional-settings/websites/behavior-customizations).
- [Variables visuales oficiales](https://www.mercadopago.com.pe/developers/es/docs/checkout-bricks/additional-content/modify-css-variables).
- [Tarjetas de sandbox](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/integration-test/cards).
- Memoria: `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`,
  `02 Decisions.md`; las notas históricas se contrastaron con el checkout vigente.
