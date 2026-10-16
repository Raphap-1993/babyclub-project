# Yape en el checkout de BABY

Estado: implementado y validado en local el 15 de octubre de 2026. Este cambio todavía no se ha publicado en producción.

## Regla comercial vigente

- **Entradas:** tarjeta o Yape a través de Mercado Pago.
- **Mesas y boxes:** únicamente tarjeta de débito/crédito, con 3DS cuando corresponda.
- La reserva persistida (`sale_origin=ticket`, sin `table_id`) determina si se admite Yape. El cliente no puede habilitarlo cambiando el monto o tipo de compra en el body. Una solicitud de Yape para mesa devuelve `400 / yape_tickets_only` antes de crear un intento o contactar al proveedor.
- El resumen `/compra` y el formulario `/pago/[id]` muestran los medios correspondientes. La API de la sesión expone `paymentMethods`, sin exponer credenciales privadas.

## Pago y emisión

El comprador de entradas ingresa su celular y el código de aprobación de seis dígitos generado por Yape. MercadoPago.js recibe esos datos directamente; BABY recibe únicamente el token de pago y el celular. El código se borra del formulario al terminar, no se envía al servidor BABY ni se guarda en la base, logs o almacenamiento del navegador.

La API genera una Order con `payment_method.id=yape`, `type=debit_card`, importe de la sesión y teléfono con código de país `51`. No agrega cuotas ni configuración de 3DS de tarjeta al pago Yape. El token es de un uso; un rechazo definitivo permite generar uno nuevo. Los resultados inciertos conservan el mismo intento/idempotencia y se consultan antes de permitir otro cobro.

Se reutilizan la firma del webhook de Orders, la consulta canónica al proveedor, el worker de recuperación y la emisión idempotente. El estado indicado por el navegador o por el cuerpo de un webhook no basta para emitir. Se verifican vendedor, aplicación, importe y estado acreditado. No hay nuevas tablas, migraciones, credenciales o permisos de base de datos.

El QR generado es el **QR de ingreso a BABY**. Yape en esta integración se confirma con código de aprobación; no se presenta un QR para escanear y pagar. La emisión mantiene un QR por persona identificada: comprador al acreditar, acompañantes al completar su nominación. No se crean QR genéricos compartidos por una mesa.

## Límites y operación

- Se comprueba el intervalo técnico de la cuenta consultada (S/ 1 a S/ 2,000 por pago); el límite configurado por el comprador en Yape puede ser inferior. Esto no modifica la regla comercial: las mesas siempre requieren tarjeta, cualquiera sea su precio.
- El control de pausa de ventas del backoffice también bloquea nuevos intentos de Yape. Las confirmaciones de intentos previos siguen procesándose.
- Los teléfonos ficticios `111111111` a `111111118` solo se admiten con configuración `test`. Producción exige un celular peruano de nueve dígitos que comience con 9.
- Mercado Pago puede responder HTTP 402 y devolver después la orden fallida en la consulta. La pantalla espera la confirmación y no habilita otro cobro mientras el estado sea incierto.
- El motivo concreto del rechazo se toma del pago canónico dentro de la Order; la Order puede indicar solo `failed`. Así se muestra, por ejemplo, “Saldo insuficiente”.

## Verificación local

131 pruebas de regresión pasaron en 18 archivos: pagos, configuración de ambientes, 3DS, pausa de ventas, backoffice, compra, reservas, nominación, QR y duplicados. Además pasaron tres pruebas optativas contra la API sandbox real de Mercado Pago y Supabase local:

1. Entrada S/ 40 acreditada; reenvío de la solicitud y del webhook firmado conserva un solo intento y un QR. Firma alterada: HTTP 401. PNG servido por la página de entrada decodificado y contrastado con el token guardado. Confirmación enviada al buzón local Mailpit.
2. Entrada rechazada por saldo insuficiente: cero QR; un token nuevo acredita la misma reserva. Se confirma el importe de S/ 40 desde la API del proveedor, aunque el body del comprador intenta enviar S/ 0.01.
3. Mesa S/ 600: solo tarjeta en la sesión; intento manipulado para pagar con Yape rechazado, con cero intentos y cero QR.

Prueba visual adicional: formulario Yape en escritorio y móvil de 390 px, rechazo y reintento aprobado mediante MercadoPago.js. La opción de tarjeta vuelve a montar sus campos seguros al alternar métodos. Una mesa local de S/ 600 y cuatro cupos se pagó con Visa ficticia y desafío 3DS `APRO-CHOK`; terminó en confirmación automática y mostró el QR activo del comprador. La producción y sus datos no se utilizaron para estas pruebas.

Evidencia privada fuera de Git: `D:/RAPHA/PROJECTS/BABYCLUB/.local/evidence/yape-checkout-desktop.png`, `yape-checkout-mobile.png`, `yape-approved-mobile.png`, `mesa-card-only.png` y `mesa-card-approved.png`. Compilación de landing, comprobación de tipos de ambas aplicaciones y `git diff --check` correctos.

Estas pruebas de Yape verifican **reenvíos locales firmados** y consulta a la API real de sandbox. No se abrió un túnel nuevo ni se probó en esta iteración la entrega espontánea de webhooks de Yape desde Internet. La validación anterior de entrega automática para tarjetas se documenta en `mercadopago-local.md`. Tampoco se hicieron cobros con una billetera o tarjeta real.

```powershell
# Desde la raíz del checkout; Supabase local, Mailpit y Next en 127.0.0.1:3004.
$env:BABY_MP_LOCAL_TESTS='1'
node node_modules/vitest/vitest.mjs run apps/landing/lib/mercadopagoCheckoutServer.local.test.ts packages/shared/payments/mercadopagoYape.test.ts apps/landing/lib/mercadopagoYape.test.ts

# Hace solicitudes reales al vendedor ficticio de Mercado Pago.
$env:BABY_MP_YAPE_SANDBOX='1'
node node_modules/vitest/vitest.mjs run apps/landing/lib/mercadopagoYape.sandbox.test.ts
```

La suite sandbox verifica `test_user`, credenciales de prueba, Supabase loopback y Mailpit antes de escribir. Crea un evento propio con datos ficticios y lo da de baja al terminar. El servidor local debe haberse reconstruido y reiniciado con el código actual.

## Referencias

- [Yape con Checkout API Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-integration/websites/yape).
- [Escenarios oficiales de prueba con Yape](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/integration-test/yape).
- [Tarjetas de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/integration-test/cards).
- Memoria contrastada: `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md`, `06 Requirements.md`. El requisito histórico Yape/Plin manual no reemplaza la integración actual de Mercado Pago ni la regla nueva de mesas por tarjeta.
