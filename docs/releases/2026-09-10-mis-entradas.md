# Mis entradas y enlaces permanentes de promotores

La compra presenta una lista por asistente con una acción principal, edición individual y borradores conservados. El comprador puede elegir otro titular sin cambiar los datos de compra. QR disponible y correo enviado se muestran como estados distintos.

Los correos de reserva llevan a Mis entradas. Reenviar una reserva envía un resumen al comprador sin emitir entradas nuevas. El QR se genera localmente desde el token vigente; una entrada usada, vencida o no disponible muestra su estado. Puerta exige el QR individual y el evento seleccionado, y vuelve a comprobar su vigencia al confirmar.

Un free vencido permite una compra nueva con los mismos datos, conservando el ticket anterior. Las entradas personales pueden compartir correo o teléfono sin fusionar asistentes distintos.

Cada promotor dispone del enlace permanente `/p/{promoterId}`. Presenta los eventos disponibles y conserva la atribución en compras de entradas o mesas. Los enlaces por evento existentes siguen disponibles.

## Integración

- Mantener despliegue Vercel de landing y backoffice desde `master`.
- Backoffice Production: `NEXT_PUBLIC_LANDING_URL=https://babyclubaccess.com`.
- Aplicar las funciones de `20260910190000_atomic_nomination_update.sql` y `20260910200000_ensure_permanent_promoter_links.sql` antes de activar esta versión.
- Las funciones son aditivas, accesibles sólo al servidor. No modifican registros históricos durante la migración.
- Al actualizar puerta, recargar la pantalla antes de escanear.

## Validación

Suite de pruebas, TypeScript de ambas aplicaciones, compilaciones de producción y revisión visual con datos simulados en escritorio y móvil. Pruebas PostgreSQL de concurrencia, edición con versión, rollback ante fallo y permisos de las funciones. El PNG del QR se decodifica con ZXing y conserva exactamente el token.

Los ensayos no envían correos a clientes ni registran compras o ingresos en producción.

## Reversión

Volver a la versión anterior de ambas aplicaciones desde Vercel. Las funciones nuevas pueden conservarse al ser aditivas; una reversión de interfaz no debe borrar entradas, pagos ni datos de asistentes. Confirmar los dos dominios después de la reversión.
