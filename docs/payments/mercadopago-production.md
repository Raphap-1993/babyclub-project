# Mercado Pago en producción — BabyClub

## Alcance y destinos

Estado 2026-10-15: Mercado Pago habilitado en modo `live` en
`babyclubaccess.com`. Cuenta real de Perú validada mediante `/users/me`,
credenciales exclusivas de Vercel/Production y webhook productivo configurado.
Supabase Cron ejecuta la recuperación cada minuto usando una clave dedicada en
Vault; las primeras ejecuciones devolvieron HTTP 200, sin errores ni trabajos
pendientes. Las migraciones y el respaldo privado están verificados; no se
crearon compras ficticias ni se efectuaron cobros reales durante la activación.

Entradas y mesas usan Orders API, campos alojados de tarjeta, validación 3DS,
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

- Poner `ENABLE_MERCADOPAGO_PAYMENTS=false` y redesplegar detiene compras nuevas.
  Mantener credenciales, webhook y recuperación para liquidar intentos pendientes.
- No eliminar las tablas `mp_*`, QR o reservas al revertir frontend. El historial
  de cobros permanece y las órdenes ambiguas se consultan, nunca se vuelven a cobrar.
- Los reembolsos completos confirmados por API desactivan los QR de esa compra.
  La gestión de reembolso de Mercado Pago se hace en su panel; la API legacy del
  backoffice continúa siendo de Culqi.
- Revisar sesiones `review`/`paid`, eventos `error` y notificaciones `error`.
  No resolver manualmente como pagado sin consultar la orden canónica.

## Evidencia y fuentes

Sandbox: pruebas reales de 3DS y webhook automático para entrada y mesa,
duplicados en paralelo, firmas alteradas rechazadas y PNG de QR decodificados.
Detalle en `mercadopago-local.md`. Validación del paso a live: 73 pruebas,
typecheck y build de landing/backoffice; ensayo SQL con rollback y comparación
de registros históricos. El cobro live todavía requiere aceptación del titular.

- [Mercado Pago: salir a producción](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/go-to-production)
- [Notificaciones Orders](https://www.mercadopago.com.pe/developers/es/docs/checkout-api-orders/notifications)
- [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
- [Vault y llamadas programadas](https://supabase.com/docs/guides/functions/schedule-functions)
