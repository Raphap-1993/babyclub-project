# CULQI INTEGRATION 2026-02

## Decisiones cerradas
- Pasarela oficial: **Culqi**
- Comprobante digital: obligatorio desde dia 1
- Reembolsos/anulaciones: primero via CulqiPanel; luego API interna en backoffice cuando tengamos `charge_id` confiable
- SLA objetivo en puerta: <= 2 segundos por validacion
- Multi-marca: un mismo dominio/plataforma (no subdominios), multi-evento por tenant/organizador
- Auditoria: toda accion critica debe ser trazable

## Hallazgos clave de documentacion oficial Culqi
- Culqi Checkout v2/v3/v4 legacy ya no es la ruta recomendada; usar **Custom Checkout**.
- En integracion con `order`, se crea la orden desde backend y se procesa con checkout.
- Para actualizar estado de pago por backend, usar webhooks y manejar evento `order.status.changed`.
- Culqi maneja devoluciones via API y CulqiPanel.
- Para llaves y seguridad: separar entorno test/produccion y usar llaves correctas por entorno.

## Arquitectura propuesta (minima y segura)
### Componentes
- Frontend `landing`: abre checkout Culqi con `order_id` creado por backend
- Backend `landing`:
  - `POST /api/payments/culqi/create-order`
  - `POST /api/payments/culqi/webhook`
  - `GET /api/payments/receipt` (comprobante digital)
- BD Supabase:
  - tabla `payments`
  - tabla `payment_webhook_events`

### Flujo recomendado
1. Front crea reserva (`pending`) y solicita `create-order`.
2. Backend crea orden en Culqi (`/orders`) con metadata de negocio.
3. Front abre checkout con `order_id`.
4. Culqi notifica webhook (`order.status.changed`).
5. Backend valida/guarda evento, actualiza `payments` y estado de reserva.
6. Backend genera `receipt_number` y expone comprobante digital.

## Reglas tecnicas obligatorias
- Idempotencia:
  - clave por operacion (`idempotency_key`) en creacion de orden
  - dedupe de webhooks por `event_key`
- Auditoria:
  - log de request/respuesta de pasarela (sin exponer secretos)
  - trazabilidad por `correlation_id`
- Seguridad:
  - `sk_test/sk_live` solo en backend
  - nunca exponer `secret key` en frontend
  - rotacion y segregacion de llaves por ambiente

## Contratos backend iniciales
### `POST /api/payments/culqi/create-order`
- Input:
  - `reservation_id` (uuid)
  - `amount` (en centimos)
  - `currency_code` (`PEN`)
  - `description`
  - `customer` (`email`, `first_name`, `last_name`, `phone_number`)
  - `idempotency_key`
- Output:
  - `order_id`
  - `payment_id`
  - `status`

### `POST /api/payments/culqi/webhook`
- Input: payload de Culqi
- Output: `ok: true`
- Efecto:
  - guarda evento en `payment_webhook_events`
  - actualiza `payments`
  - si pago aprobado: actualiza reserva y genera comprobante digital

### `GET /api/payments/receipt?order_id=...`
- Output:
  - `receipt_number`
  - `status`
  - `amount`
  - `currency_code`
  - `issued_at`
  - `customer_name`

## Checklist de go-live
- Variables de entorno configuradas por ambiente
- Webhook Culqi apuntando a endpoint productivo
- Test cards en entorno test validadas
- Prueba de flujo completo:
  - create-order -> checkout -> webhook -> comprobante
- Prueba de reintentos/idempotencia
- Runbook de incidente y rollback publicado

## Fuentes oficiales
- Custom Checkout: https://docs.culqi.com/es/documentacion/checkout/v4/culqi-custom-checkout/
- Checkout v4 (legacy/no recomendado): https://docs.culqi.com/es/documentacion/checkout/v4/culqi-checkout/
- OneClick + ordenes + webhook `order.status.changed`: https://docs.culqi.com/es/documentacion/pagos-online/recurrencia/oneclick/
- Llaves y seguridad (CulqiJS): https://docs.culqi.com/es/documentacion/pagos-online/culqijs/introduccion/
- Tarjetas de prueba: https://docs.culqi.com/es/documentacion/pagos-online/culqijs/tarjetas-de-prueba/
- Devoluciones: https://docs.culqi.com/es/documentacion/pagos-online/devoluciones/
