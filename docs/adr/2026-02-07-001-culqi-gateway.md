# ADR 2026-02-07-001: Culqi como pasarela principal

## Estado
Aprobado

## Contexto
El proyecto requiere cobro online para:
- entradas
- reservas de mesa/box
- futura venta directa durante evento

Necesidades clave:
- integracion con medio local Peru
- webhook para conciliacion
- reembolsos con trazabilidad
- arranque rapido con costo controlado

## Decision
Se adopta **Culqi** como pasarela principal de pagos.

Se implementa backend-first con:
- creacion de orden desde backend
- webhook de estado de orden
- persistencia de pagos y eventos webhook en Supabase
- comprobante digital interno desde backend

## Consecuencias
### Positivas
- alineacion con objetivo comercial inmediato
- mejor trazabilidad (pagos + webhooks + receipt)
- base para idempotencia y auditoria empresarial

### Riesgos
- dependencia de conectividad en puerta y landing
- necesidad de manejo robusto de reintentos/webhooks
- necesidad de controlar llaves/secrets por ambiente

## Rollback
- mantener flujo manual actual (voucher) habilitado por feature flag
- desactivar endpoints de pago si se detecta falla critica
- continuar validacion manual en backoffice mientras se estabiliza webhook
