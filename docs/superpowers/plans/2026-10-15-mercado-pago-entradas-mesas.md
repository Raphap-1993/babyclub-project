# Integración de Mercado Pago para entradas y mesas

Fecha: 2026-10-15, America/Lima.
Estado: aplicación BabyClub Access creada con Checkout API / Orders; credenciales de prueba guardadas y acceso al vendedor de prueba de Perú verificado. Cliente técnico de Orders preparado y probado; checkout, persistencia y webhooks aún pendientes de integración.

BABY solicita sustituir el cobro con comprobante y aprobación manual por Mercado Pago para entradas, mesas y boxes. Se conservarán el croquis, los paquetes por evento, la atribución de promotores y la nominación de asistentes. El cambio de proveedor no modifica compras anteriores.

## Situación comprobada

La revisión parte del código publicado `d4d7acd` en `production/master` y del worktree `.local/release`. No se han modificado reservas, pagos, credenciales ni datos de producción.

- `apps/landing/app/compra/page.tsx` coordina ambos flujos con métodos `yape` y `culqi`. El camino operativo usa comprobante; Culqi tiene controles de disponibilidad en runtime.
- `apps/landing/app/api/reservations/route.ts` crea reservas de mesas y bloquea otra solicitud activa para la misma mesa/evento. Su comprobación y su inserción son operaciones separadas; falta una garantía transaccional para compras concurrentes y una caducidad de retención de pago online.
- `apps/landing/app/api/ticket-reservations/route.ts` calcula entradas y paquetes desde la base y conserva el importe en la reserva. Para mesas hay que persistir también el precio validado del producto/evento antes de cobrar.
- `packages/shared/payments/registry.ts` solo registra Culqi. Aunque hay rutas con `[provider]`, todavía no existe un proveedor Mercado Pago.
- `packages/shared/payments/service.ts` supone el contrato Culqi de crear orden y después crear cargo. Además normaliza el cargo con `normalizeCulqiStatus`; no se puede reutilizar ese camino para Orders sin una adaptación explícita.
- Ese servicio cambia el estado de la reserva a `approved`, pero no ejecuta el proceso completo de emisión y nominación de `apps/backoffice/app/api/reservations/update/route.ts`. La confirmación automática debe compartir las reglas de negocio sin llamar una ruta administrativa desde un webhook público.
- La deduplicación actual de webhooks devuelve éxito ante cualquier evento ya insertado, incluso si su procesamiento anterior falló. Mercado Pago necesita reintentos recuperables y protección ante eventos fuera de orden.
- La migración histórica `2026-04-24-payment-provider-polymorphism.sql` contempla proveedores genéricos. Antes de desplegar se debe comprobar su presencia en el esquema objetivo; su existencia en Git no demuestra que se haya aplicado allí.

## Solución prevista

Usar Checkout API con Orders para mantener el pago dentro de la web, siguiendo el enlace compartido por el gerente. Para tarjetas, usar Card Payment Brick y tokenización de MercadoPago.js. Yape, si está disponible en la aplicación de BABY, utilizará su integración propia con token; no es el actual comprobante de transferencia. No se asume soporte de Plin por analogía con el método manual.

Orders permite crear y procesar el pago con una sola operación. La interfaz pública pedirá una sesión de compra con precio confirmado por el servidor y enviará únicamente el token y los datos requeridos del medio de pago. Un resultado visual del navegador nunca será suficiente para acreditar una compra.

Referencias oficiales: [tarjetas](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-integration/websites/cards), [Yape](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/payment-integration/websites/yape), [modelo de integración](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/integration-model).

## 1 Cuenta y ambientes

1. Entrar con la cuenta de BABY en [Tus integraciones](https://www.mercadopago.com.pe/developers/panel/app) e identificar la aplicación existente. Crear otra solo si no hay una adecuada. Registrar nombre e ID de aplicación y confirmar país y titular de cobro.
2. Obtener Public Key y Access Token de **prueba**, y posteriormente el secreto de firma del webhook. Las credenciales se introducen directamente en archivos ignorados o en variables de entorno del despliegue; no en chat, Git, documentación ni logs.
3. Usar Supabase local con datos ficticios. El ambiente de prueba del proveedor y la base local son controles independientes: ambos deben estar configurados correctamente.
4. Separar explícitamente prueba y producción. El prefijo del Access Token no permite distinguirlas: la documentación actual indica `APP_USR` para ambos. No adivinar el ambiente por ese prefijo.
5. Public Key puede llegar al navegador; Access Token y secreto de webhook se mantienen exclusivamente en servidor. No activar todavía el cobro online en el dominio productivo.

Referencia: [crear aplicación y credenciales de prueba](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/create-application).

## 2 Persistencia y precio de la compra

- Crear una sesión de compra con identificador y acceso no adivinable, reserva, evento, concepto, cantidad, importe en céntimos, moneda PEN, ambiente, vencimiento y estado. Validar el acceso tanto al pagar como al consultar el resultado.
- Recalcular entradas/paquetes y mesas/productos desde datos de servidor. Persistir un snapshot del precio aceptado; no confiar en `amount` ni en un producto arbitrario enviado por el navegador.
- Retener mesa/box y cupo de entradas con garantía transaccional. Dos compradores no pueden pagar el mismo espacio. Las retenciones vencidas liberan inventario de forma controlada; un pago aprobado tardío requiere conciliación, no apropiarse de una mesa revendida.
- Persistir cada intento antes de llamar al proveedor. Utilizar la misma clave de idempotencia para reintentar un intento ambiguo; una nueva tarjeta/token tras un rechazo corresponde a un intento nuevo controlado. Impedir dos intentos cobrables concurrentes para la misma compra.
- Guardar referencias del proveedor, estados y trazas sanitizadas. No persistir token de tarjeta, OTP, PAN o CVV en `provider_payload`, metadata ni logs.
- Preparar una migración aditiva y ensayarla localmente; no reconstruir ni reinicializar la base remota.

## 3 API de pago y notificaciones

- Implementar un adaptador Orders independiente del contrato Culqi. Mantener las rutas legacy para compras históricas y no registrar Mercado Pago en el servicio genérico hasta que su contrato esté resuelto.
- El endpoint de pago resuelve el precio y la reserva por la sesión de compra; llama a Orders con idempotencia y devuelve un estado público acotado. Los timeouts no se convierten en un segundo cobro con una clave diferente.
- Ruta prevista, aún no implementada: `POST /api/payments/mercadopago/webhook`. Configurar el tópico **Order (Mercado Pago)** en una URL HTTPS del ambiente correspondiente.
- Validar la firma `x-signature` con el secreto y los campos indicados por Mercado Pago, preferentemente mediante su SDK oficial. Contrastar el identificador de la URL con el cuerpo y consultar la orden canónica al proveedor antes de cambiar una compra.
- Verificar relación con el intento registrado, vendedor/aplicación cuando los datos oficiales lo permitan, ambiente, moneda y monto esperado. Un webhook desconocido no crea ni aprueba una reserva usando metadata arbitraria.
- Registrar recepción y trabajo pendiente duradero antes de responder éxito. Reprocesar fallos sin volver a cobrar. La aplicación de estado y la confirmación comercial deben ser idempotentes y no retroceder por un aviso antiguo.
- Solo el pago acreditado habilita la confirmación. Pago autorizado pendiente de captura, en proceso, rechazado, cancelado o reembolsado no se trata como una venta nueva aprobada.
- Reembolsos parciales, completos y contracargos requieren estado comercial y seguimiento explícitos; no equiparar `processed` con una venta recién acreditada en todos los casos.

Referencia: [notificaciones de Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/notifications).

## 4 Confirmación, QR y operación

- Extraer un servicio de confirmación reutilizable para aprobación manual y pago verificado, conservando autorización en las rutas administrativas.
- Ejecutar una sola vez la confirmación de reserva, la preparación de unidades y la emisión del comprador. Los acompañantes conservan el flujo de nominación existente y la regla de un QR activo por persona/evento.
- Mantener la cantidad de entradas incluida en mesas/boxes, la clasificación comercial, los promotores y los reportes. El proveedor de cobro no debe alterar estos datos.
- Separar emisión y correo con un trabajo recuperable. Un error de correo no debe solicitar un nuevo pago ni deshacer un pago acreditado.
- En backoffice mostrar proveedor, importe, referencia, pago pendiente/acreditado/rechazado y pendientes de conciliación; separar la revisión manual de comprobantes históricos.

## 5 Pantalla de compra

- Conservar selección de entradas o croquis de mesas, datos del comprador y aceptación de términos.
- Reemplazar carga de comprobante por pago integrado cuando Mercado Pago esté habilitado y la compra sea elegible. Ambas modalidades tendrán la misma importancia.
- Usar el formulario oficial para tarjetas y una opción Yape independiente si se habilita. No capturar datos completos de tarjeta en inputs propios.
- Mostrar estados claros: listo para pagar, procesando, pendiente de confirmación, aprobado y rechazado. Bloquear doble envío y permitir recuperar una compra tras recargar o cerrar la pestaña.
- Confirmar el resultado con la sesión de compra y el servidor antes de mostrar QR. No aceptar parámetros de retorno como prueba de pago.

## 6 Validación y activación

La salida requiere pruebas en entradas individuales, paquetes, mesas y boxes, tanto en celular como en PC. Cubrir al menos: pago acreditado, rechazo y reintento, pago pendiente, webhook duplicado, firma inválida, monto distinto, vendedor/ambiente incorrecto, evento fuera de orden, timeout después de cobrar, fallo recuperable de emisión/correo, doble compra simultánea de mesa y pago tardío tras vencimiento.

Después de los ensayos con credenciales de prueba, completar las verificaciones de cuenta y aplicación que muestre Mercado Pago, revisar datos comerciales y legales publicados y preparar las variables productivas. La documentación oficial exige HTTPS para operar en producción. No se ha comprobado aún el estado de habilitación de la cuenta de BABY.

Publicar con el proveedor desactivado, verificar el despliegue y activar solo cuando el flujo completo esté validado. Mantener un interruptor de nuevas compras para contingencias, sin detener la conciliación de pagos ya enviados. Retirar el comprobante del nuevo flujo al completar la transición; las reservas manuales anteriores siguen siendo administrables.

Referencia: [salir a producción](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/go-to-production).

## Estado de este trabajo

- Documentación oficial y flujo actual revisados.
- El usuario completó la verificación del titular y la creación en el navegador integrado. Aplicación **BabyClub Access**, ID `2226437819713`, Checkout API vía Orders.
- Credenciales de prueba activas para Perú, con consentimiento del usuario. El panel asocia las pruebas a la aplicación `6682958408134086` y al usuario de prueba `3765564505`; no confundirlos con los IDs productivos.
- `.local/mercadopago.env` está excluido de Git y restringido al usuario de Windows y SYSTEM. El titular pegó el Access Token directamente en el archivo; no se almacena en este documento.
- `scripts/local/check-mercadopago-access.mjs` realizó exclusivamente `GET /users/me` y verificó el vendedor de prueba esperado, `site_id=MPE` y `country_id=PE`. No creó órdenes ni cobros.
- Docker y Supabase local volvieron a estar operativos con los contenedores existentes; no se reinicializó la base.
- `packages/shared/payments/mercadopagoOrders.ts` prepara y consulta Orders con idempotencia, importes exactos en céntimos y conciliación por referencia, monto, país, vendedor y aplicación. Es una base técnica aislada: no está registrada en el gateway Culqi ni conectada a rutas públicas o pantallas de compra. No incluye aún un receptor de webhooks.
- Verificación: 27 pruebas pasan entre el cliente nuevo y los servicios existentes de pago. La llamada real realizada fue la consulta de identidad; estas pruebas de Orders usan respuestas simuladas. No se ha realizado todavía una compra de prueba con tarjeta ni una validación integral de compra/QR.
- Webhooks, productos efectivamente habilitados y pruebas de API pendientes. Credenciales productivas sin activar por este trabajo.
- Este archivo es un plan de implementación. No se implementaron endpoints ni se activó Mercado Pago; producción conserva su comportamiento.

Memoria consultada: `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md` y `06 Requirements.md`. El código publicado prevalece sobre esas notas históricas.
