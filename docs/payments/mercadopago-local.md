# Mercado Pago: checkout local de entradas y mesas

Estado al 2026-10-15 18:06 America/Lima: checkout, 3DS y webhooks automáticos probados en sandbox. Incidencia de firma resuelta y emisión independiente de QR comprobada para entrada y mesa. Rama `codex/mercadopago-orders`, sin publicación ni cobros reales; todavía falta preparar el entorno productivo.

## Entorno

- Aplicación principal BabyClub Access: `2226437819713`.
- Aplicación y vendedor generados por Mercado Pago para pruebas: `6682958408134086` / `3765564505`.
- Supabase aislado: API `http://127.0.0.1:64321`, PostgreSQL `64322`, Studio `64323`.
- Landing de este checkout de trabajo: `http://127.0.0.1:3004`. El workspace habitual conserva sus puertos.
- Mailpit: `http://127.0.0.1:64324`. Los correos de esta prueba se capturan allí.
- Evento ficticio: `20000000-0000-4000-8000-000000000001`. No se copiaron clientes.

El archivo privado `D:\RAPHA\PROJECTS\BABYCLUB\.local\mercadopago.env` contiene las credenciales autorizadas. La landing recibe su configuración en `apps/landing/.env.local`, también excluido de Git. No guardar sus valores en notas, commits, capturas ni conversaciones.

Variables de servidor: `MERCADOPAGO_ENVIRONMENT=test`, `MERCADOPAGO_APPLICATION_ID`, `MERCADOPAGO_TEST_APPLICATION_ID`, `MERCADOPAGO_COLLECTOR_ID`, `MERCADOPAGO_PUBLIC_KEY`, `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_WORKER_SECRET`, `ENABLE_MERCADOPAGO_PAYMENTS=true`. Correo: `BABY_EMAIL_TRANSPORT=mailpit`, `MAILPIT_URL=http://127.0.0.1:64324`.

La Public Key se entrega al formulario. Access Token, firma del webhook, llave del worker y Service Role permanecen en servidor. Este corte rechaza bases remotas y modo live aunque se active la bandera. El prefijo `APP_USR` no distingue credenciales reales de las del vendedor de prueba.

## Funcionamiento

1. Las APIs de entradas y mesas validan el evento, precio, paquete y disponibilidad. Guardan la cotización en céntimos y una reserva de veinte minutos. El navegador no decide cuánto cobrar.
2. La solicitud usa un UUID y una capacidad aleatoria de 256 bits. Los reintentos recuperan la misma compra. En base se almacena el hash; la capacidad viaja en el fragmento del enlace y en Authorization, sin query string ni logs de servidor.
3. `/pago/[id]` usa los campos alojados de MercadoPago.js. PAN, vencimiento y CVV permanecen en los iframes de Mercado Pago. El documento del titular se normaliza antes de tokenizar (`C.E` → `CE`) y se envía directamente al proveedor, sin duplicarlo en Orders.
4. El servidor crea `/v1/orders` con un intento persistido, `external_reference` e `X-Idempotency-Key` iguales. Relee la orden y compara vendedor, aplicación de prueba, país, importe y acreditación completa.
5. Solo una orden acreditada aprueba la reserva. Se preparan las unidades y códigos de toda la compra y se emite el QR del comprador. Los acompañantes reciben su QR al completar sus propios datos en Mis entradas.
6. El correo se agenda aparte, con una clave idempotente. Reintentar su envío no repite el cobro ni la emisión.

Las guardas de PostgreSQL serializan reservas por evento, bloquean dos reservas de la misma mesa y dos compras activas del mismo comprador, verifican aforo incluyendo tickets fuera de reservas y evitan emitir o reactivar tickets de una sesión impaga/devuelta. Una devolución completa desactiva los tickets y códigos.

Las sesiones abandonadas vencen y liberan su reserva. Los intentos pendientes o desconocidos conservan su lugar hasta resolver el pago: un timeout no autoriza un nuevo cobro. La conciliación puede recuperar una orden por referencia y fechas incluso si el navegador se cerró sin recibir su ID. Un resultado vacío de búsqueda conserva la verificación.

## Autenticación bancaria 3DS

Orders recibe `config.online.transaction_security` con `validation=on_fraud_risk` y `liability_shift=required`. Cuando la orden canónica devuelve `action_required / pending_challenge`, se guarda la URL bancaria en la tabla privada de intentos y se muestra en el checkout autorizado. Solo se aceptan URLs HTTPS del proveedor y de la ruta de autenticación esperada; nunca URLs enviadas por el comprador.

El recuadro puede reanudarse con el mismo enlace de compra. Un mensaje `COMPLETE` solo dispara una nueva consulta al servidor: exige origen y ventana correctos, y nunca emite un QR por sí mismo. El plazo visible del desafío es de cuarenta minutos desde la creación del intento. Al terminar el plazo se espera el estado canónico antes de liberar o permitir otro cobro. Los estados fallido/cancelado permiten otro intento únicamente si la reserva sigue vigente; una respuesta pendiente tardía no recupera un desafío de una compra ya pagada.

La URL del desafío contiene una capacidad de invitado: no incluirla en logs, capturas de la barra de direcciones, commits ni reportes.

## Webhooks y conciliación

Endpoint: `POST /api/payments/mercadopago/webhook`. Valida firma con `WebhookSignatureValidator` del SDK oficial. Pasa el ID en minúsculas al validador, como lo firma el emisor automático de Orders; el SDK Node 3.6.1 solo recorta espacios y no realiza esa conversión. Conserva el ID original para comprobar la coincidencia exacta entre query y body, persistir el evento y consultar el recurso canónico. Nunca aprueba a partir del importe o estado del body.

La clave local debe pertenecer a la aplicación sandbox `6682958408134086`, no a la principal `2226437819713`. Para obtenerla, iniciar sesión en Developers con **Seller Test User** (cuenta ficticia de la aplicación principal), abrir la aplicación sandbox y consultar Webhooks > Configurar notificaciones. La URL de prueba puede propagarse desde la principal, pero su firma es distinta. Leer y guardar la clave existente en los dos archivos privados; no restablecer firmas para intentar corregir esta diferencia de cuentas. No imprimir ni adjuntar claves.

El simulador del panel envía `live_mode=true` incluso a la URL de prueba. El ambiente se comprueba contra el vendedor y la aplicación canónicos, no contra ese indicador del simulador.

El worker recupera intentos sin respuesta, eventos recibidos/con error, emisiones y correos pendientes. El endpoint de conciliación exige una llave propia, independiente de la capacidad de compra. Desactivar nuevas ventas conserva la conciliación de compras existentes.

```powershell
# Desde este checkout, con Docker Desktop y Supabase local ya iniciados:
Set-Location apps/landing
node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3004

# En otra terminal, desde la raíz de este checkout:
node scripts/local/mercadopago-worker.mjs apps/landing/.env.local http://127.0.0.1:3004
```

Para una pasada: agregar `--once`. El transporte Mailpit solo acepta servicios loopback. Los envíos a Resend real no forman parte de estas pruebas.

Para probar entrega externa se autorizó un túnel temporal, apuntando al proxy `scripts/local/mercadopago-webhook-proxy.mjs` en `127.0.0.1:64425`. Este proxy acepta únicamente POST al webhook, limita el body y rechaza cualquier otra ruta. Nunca publicar el servidor Next completo, Studio o PostgreSQL con ese túnel. Al cerrar la prueba se cierra el túnel; su URL deja de servir y debe reemplazarse en la próxima sesión.

## Validación

- Entrada S/ 40 y mesa S/ 600 acreditadas en el vendedor sandbox, con QR del comprador.
- Compra con C.E acreditada usando los campos seguros y sin duplicar identificación en Orders.
- Rechazo `OTHE`: la orden puede llegar con HTTP 402 aunque exista. Se recupera y registra como fallida, permitiendo otro intento sin otra reserva ni QR.
- Pendiente `CONT`: conserva la compra en verificación, con cero QR.
- Webhooks automáticos de entrada y mesa: firma válida y HTTP 200, con checkout cerrado y worker detenido. Acreditaron las compras y emitieron el QR de cada comprador.
- Pruebas locales de notificaciones repetidas, estados falsos en el body, importe distinto, capacidad, reserva simultánea, credencial incorrecta, reanudación de emisión y devolución.
- Flujo público hasta checkout y vista móvil de 390 px sin desbordamiento horizontal.
- Nominación de un acompañante en una mesa pagada: segundo QR independiente, sin volver a cobrar.
- 3DS real de sandbox con titular `APRO-CHOK`: desafío, aprobación y un QR de entrada.
- 3DS real con `OTHE-CHNO`: desafío rechazado, cero QR y formulario disponible para reintentar.
- Mesa / box 2, S/ 600 y ocho unidades: desafío reanudado tras recargar, cero QR antes de acreditar y QR del comprador después de aprobar.
- Desafío de mesa en viewport de 390 px: formulario bancario y botón Confirmar visibles, sin desbordamiento horizontal.
- Compra 3DS con la página cerrada: la API del proveedor ya estaba acreditada, la base local seguía pendiente; una pasada del worker la pasó a `fulfilled`, con un QR y cero errores. El webhook de esa orden seguía rechazado; esta evidencia corresponde a conciliación, no a entrega automática válida.
- 41 pruebas aprobadas en diez archivos en esta iteración, comprobación de tipos y build de landing correctos. Cubren, entre otros, firma falsa, duplicados, aforo, exclusividad de mesa, rechazo, devolución, desafío persistente y mensajes de otras ventanas/orígenes. El vencimiento y la cancelación se cubrieron con fixtures locales; no se esperó un vencimiento real de cuarenta minutos en Mercado Pago.

### Firma automática: causa y corrección verificadas

El primer diagnóstico reprodujo `SignatureMismatch` con notificaciones espontáneas y HTTP 200 con el simulador de la aplicación principal. La clave del panel principal sí coincidía con los archivos privados, pero **no era la clave de la aplicación que emitía los eventos automáticos**. Restablecer la clave principal no resolvía esa diferencia.

Se accedió a la aplicación del vendedor ficticio con su propia cuenta y se comprobó que tenía otra firma. Al combinar esa firma con `data.id.toLowerCase()`, coincidieron exactamente los HMAC de tres notificaciones automáticas ya capturadas. Con la firma principal o con el ID en mayúsculas no coincidían. La corrección mantiene HMAC obligatorio y la consulta canónica; no añade excepciones para sandbox ni acepta firmas inválidas.

Prueba independiente el 15 de octubre, con el formulario bancario 3DS abierto por separado, la página BABY cerrada y el worker detenido antes de aprobar:

| Compra sandbox | Orden | Notificación procesada (America/Lima) | Resultado |
| --- | --- | --- | --- |
| Entrada S/ 40 | `ORDTST01M50WJ10ZQMSH2YMK46WRS4VC` | 18:03:44 | HTTP 200, `fulfilled`, un QR activo |
| Mesa / box 3 S/ 600 | `ORDTST01M50WYKFA4A23HEAHVXE1F9T7` | 18:05:38 | HTTP 200, `fulfilled`, QR del comprador y diez unidades |

El box 3 tiene `tables.ticket_count=10`; esa es la cantidad que usa la reserva, aunque la descripción de su producto local menciona ocho. Se preservó la regla existente y no se alteró su configuración en este arreglo. Antes de acreditar, ambas compras tenían cero QR. La mesa quedó con una unidad emitida y nueve pendientes de nominación, según la regla de un QR por persona identificada.

Reenviar cinco veces en paralelo el evento automático capturado de la mesa devolvió HTTP 200 con `duplicated=true`, conservando el mismo QR. Alterar su firma devolvió HTTP 401. La regresión local comprueba además que el body/query deben coincidir exactamente y que el ID original llega a la API canónica. 41 pruebas en diez archivos y build de landing aprobados.

Desde Mis entradas se nominó un acompañante ficticio y se emitió su QR independiente: la mesa pasó a dos de diez entradas listas, sin otro pago. Se extrajeron los tres PNG realmente servidos por las páginas de ticket (entrada, comprador de mesa y acompañante), de 520 × 520 px, y se decodificaron localmente con ZXing. Cada contenido coincidió con su `tickets.qr_token` activo y los tres fueron distintos. El correo de prueba se capturó en Mailpit.

Evidencia local, excluida de Git: `../mercadopago/webhook-mesa-confirmada.png`, `../mercadopago/webhook-mesa-acompanante.png` y `../mercadopago/webhook-entrada-qr-visible.png` (rutas relativas a este checkout). El túnel y el proxy de diagnóstico se cierran al terminar; se conserva la aplicación local y se reactiva el worker de recuperación.

La comprobación independiente del webhook quedó satisfecha; los resultados anteriores no dependen del simulador ni de la conciliación. No se envió ningún reporte a terceros.

```powershell
$env:BABY_MP_LOCAL_TESTS='1'
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --testTimeout=30000 --hookTimeout=30000 apps/landing/lib/mercadopagoCheckoutServer.local.test.ts
node node_modules/vitest/vitest.mjs run packages/shared/payments/mercadopagoOrders.test.ts packages/shared/payments/mercadopagoConfig.test.ts apps/landing/lib/mercadopagoCard.test.ts
```

La suite de base exige loopback, crea registros sintéticos en un evento propio y los da de baja al terminar. No ejecutar contra producción. Las migraciones `20261015210000_mercadopago_checkout.sql` y `20261015223000_mercadopago_3ds.sql` se aplicaron exclusivamente en la base local, sin reinicializarla.

## Paso productivo pendiente

Esta rama no habilita live ni fue publicada. Antes de un release deben prepararse credenciales productivas separadas (incluida la firma de la aplicación productiva), endpoint HTTPS estable, worker duradero con alertas/revisión de intentos sin resolver y correo real. 3DS y webhook automático están validados en sandbox. El checkout actual cubre tarjetas; Yape dentro de Mercado Pago es otra integración. Los cambios se revisan antes de migrar datos reales o activar cobros.

## Referencias

- [Tarjetas / Checkout API Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-integration/websites/cards).
- [Campos seguros oficiales](https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md).
- [Webhooks de Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/notifications).
- [3DS para Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-management/integrate-3ds).
- [Búsqueda de órdenes](https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-api/search-order/get).
- [Tarjetas ficticias y estados de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/integration-test/cards).
- Memoria contrastada: `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md`, `06 Requirements.md`. La decisión de tipos/precios por evento se mantiene en `docs/adr/2026-04-25-008-event-ticket-types-per-event.md`; el código y las migraciones prevalecen ante diferencias históricas.
