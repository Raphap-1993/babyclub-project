# Mercado Pago: checkout local de entradas y mesas

Estado: implementación de prueba, sin publicación ni cobros reales. Rama `codex/mercadopago-orders`.

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

## Webhooks y conciliación

Endpoint: `POST /api/payments/mercadopago/webhook`. Valida firma con `WebhookSignatureValidator` del SDK oficial, exige que coincidan query y body, persiste el evento y consulta el recurso canónico. Nunca aprueba a partir del importe o estado del body.

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
- Webhook enviado desde el simulador oficial: firma válida y HTTP 200, sin duplicar la entrada existente.
- Pruebas locales de notificaciones repetidas, estados falsos en el body, importe distinto, capacidad, reserva simultánea, credencial incorrecta, reanudación de emisión y devolución.
- Flujo público hasta checkout y vista móvil de 390 px sin desbordamiento horizontal.
- Nominación de un acompañante en una mesa pagada: segundo QR independiente, sin volver a cobrar.
- 67 pruebas aprobadas entre pagos, reservas, emisión y correo; tipos de backoffice y compilación de landing correctos.

La entrega espontánea de eventos de órdenes sandbox no se da por verificada por la prueba del simulador. La compra aprobada se confirma además por respuesta canónica y conciliación. Antes de liberar, comprobar la suscripción de la aplicación/vendedor correspondiente con un endpoint estable y un evento automático de una nueva orden.

```powershell
$env:BABY_MP_LOCAL_TESTS='1'
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --minWorkers=1 --testTimeout=30000 --hookTimeout=30000 apps/landing/lib/mercadopagoCheckoutServer.local.test.ts
node node_modules/vitest/vitest.mjs run packages/shared/payments/mercadopagoOrders.test.ts packages/shared/payments/mercadopagoConfig.test.ts apps/landing/lib/mercadopagoCard.test.ts
```

La suite de base exige loopback, crea registros sintéticos en un evento propio y los da de baja al terminar. No ejecutar contra producción. La migración `20261015210000_mercadopago_checkout.sql` se aplicó exclusivamente en la base local, sin reinicializarla.

## Paso productivo pendiente

Esta rama no habilita live ni fue publicada. Antes de un release deben prepararse credenciales productivas separadas, endpoint HTTPS estable y entrega automática observada, worker duradero con alertas/revisión de intentos sin resolver, correo real y prueba de autenticación bancaria 3DS cuando sea requerida. El checkout actual cubre tarjetas; Yape dentro de Mercado Pago es otra integración. Los cambios se revisan antes de migrar datos reales o activar cobros.

## Referencias

- [Tarjetas / Checkout API Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-integration/websites/cards).
- [Campos seguros oficiales](https://github.com/mercadopago/sdk-js/blob/main/docs/fields.md).
- [Webhooks de Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/notifications).
- [Búsqueda de órdenes](https://www.mercadopago.com.pe/developers/es/reference/online-payments/checkout-api/search-order/get).
- [Tarjetas ficticias y estados de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/integration-test/cards).
- Memoria contrastada: `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md`, `06 Requirements.md`. La decisión de tipos/precios por evento se mantiene en `docs/adr/2026-04-25-008-event-ticket-types-per-event.md`; el código y las migraciones prevalecen ante diferencias históricas.
