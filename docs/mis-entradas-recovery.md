# Recuperación de entradas

`/mis-entradas` permite solicitar los accesos con el correo utilizado para comprar o nominar una entrada. Pegar el enlace anterior sigue disponible como opción secundaria.

El endpoint `POST /api/tickets/recover` responde de forma uniforme, exista o no una compra, y consulta/envía después de responder mediante Next `after`. Nunca devuelve identificadores, datos del comprador ni QR al navegador.

- Entradas: coincidencia exacta sin distinguir mayúsculas del correo de la propia entrada; activa, sin eliminar, pago `paid` o sin pago legacy. No se obtiene el espacio de compra de otro titular a través de una entrada nominada.
- Compras y mesas: correo del comprador, reserva aprobada y sin eliminar.
- Se envían hasta 20 enlaces de cada clase, del más reciente al más antiguo. Son los accesos existentes: no se reemiten ni cambian QR.
- Destino fijado al mismo correo buscado. Se escapan comodines de SQL LIKE y HTML.
- Cinco solicitudes por IP cada 15 minutos y una por destinatario cada 20 minutos, en memoria por instancia. La clave de idempotencia de Resend deduplica por destinatario y ventana de 20 minutos entre instancias. No es un contador distribuido estricto; una protección global más fuerte requeriría almacenamiento compartido o WAF.
- Los errores de entrega quedan registrados con un mensaje genérico sin correo ni enlaces. No hay una cola de reintento para este envío; el cliente puede volver a solicitarlo transcurrido el plazo.
- El correo usa el origen público configurado, nunca el Host de la solicitud. En local los enlaces apuntan al dominio público: para verificar la ruta con datos ficticios se reemplaza solo el origen por localhost.

Validación: pruebas unitarias de privacidad, destinatario, filtros, escape e idempotencia; envío HTTP real a Mailpit con compra ficticia y apertura local de enlaces de entrada y reserva (HTTP 200). Ningún envío a clientes reales y ninguna migración o escritura de datos productivos.

Contexto consultado: Obsidian `20_Projects/babyclub-monorepo/00 Context.md`, `01 Status.md`, `02 Decisions.md`; contrastado con el código actual. Se aplicó la skill `email-best-practices` a este correo transaccional.
