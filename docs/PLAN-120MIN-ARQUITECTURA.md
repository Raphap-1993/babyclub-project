# PLAN 120 MIN - ARQUITECTURA Y CORE NEGOCIO

## Objetivo de la sesion
Organizar el proyecto para soportar:
- pagos online (Culqi)
- operacion estable de landing publica
- control de acceso QR en puerta
- evolucion a arquitectura modular sin romper V1

Fecha: 2026-02-07
Duracion: 120 minutos

## Resultado esperado al terminar
- Alcance P0/P1/P2 aprobado
- Matriz de permisos inicial cerrada
- Backlog tecnico priorizado con dueños
- Ruta de migracion V1 -> V2 por modulos
- Riesgos y rollback minimo definidos

## Agenda sugerida (bloques)
### Bloque 1 (0-20 min): cierre de alcance
- Confirmar modulos P0:
  - landing publica
  - checkout/pagos
  - emision de ticket QR
  - escaneo de puerta
- Congelar no-P0 para evitar dispersion

### Bloque 2 (20-45 min): modelo de roles y seguridad
- Validar permisos base por rol:
  - admin, puerta, promotor, moso, cajero, cliente_final
- Definir reglas de autorizacion de anulaciones (cajero -> admin/superior)
- Definir requerimiento de auditoria por accion critica (quien, cuando, que cambio)

### Bloque 3 (45-70 min): contratos y backend-first
- Acordar que datatables, filtros y paginacion se resuelven en backend
- Definir contrato minimo para:
  - `POST /api/tickets`
  - `POST /api/reservations`
  - `POST /api/scan` y `POST /api/scan/confirm`
  - pagos (`/api/payments/*`) con idempotencia
- Definir formato unico de errores API

### Bloque 4 (70-95 min): datos y consistencia
- Identificar operaciones que deben ser idempotentes:
  - crear ticket
  - registrar pago
  - confirmar escaneo
  - crear/anular venta en caja
- Definir columnas/auditoria minima por tabla critica:
  - `created_at`, `updated_at`, `deleted_at`, `created_by`, `updated_by`
- Confirmar politicas de backup y restore de Supabase

### Bloque 5 (95-120 min): plan de ejecucion
- Priorizar backlog en 3 niveles:
  - P0 (bloqueante negocio)
  - P1 (importante corto plazo)
  - P2 (mejoras de producto)
- Definir responsables por frente:
  - producto, arquitectura, backend, frontend, QA, DevOps
- Cerrar criterio de salida y plan de rollback

## Backlog recomendado
## P0 (ejecutar primero)
- Endurecer CI: test + lint + types + build
- Implementar idempotencia en emision de tickets
- Estandarizar paginacion/filtros en backend para datatables
- Implementar correlation_id para trazabilidad
- Definir politica de rollback y checklist pre/post deploy

## P1 (siguiente iteracion)
- Integracion robusta de pasarela (Culqi) con webhook y reconciliacion
- RBAC mas granular (roles + permisos por modulo + acciones)
- Reportes base (asistencia por codigo/promotor, ventas por rango de fechas)
- Exportacion Excel desde backend (no logica distribuida en frontend)

## P2 (expansion producto)
- Multi-evento/multi-marca (BabyClub + otros eventos)
- Personalizacion de marca/tema por evento
- Notificaciones segmentadas (cumpleanos por mes/evento)
- Reordenamiento manual de promotores y reglas de visualizacion

## Criterios de arquitectura (no negociables)
- Backend-first para reglas de negocio y consultas
- API versionada para cambios incompatibles (`/v2/*`)
- Migraciones aditivas y soft delete
- Sin logica critica en frontend
- Operaciones financieras y de acceso con idempotencia obligatoria

## Riesgos actuales y mitigacion
1. Duplicados por reintentos
   - Mitigacion: idempotency-key + dedupe en BD
2. Inconsistencias por logica en frontend
   - Mitigacion: mover filtros/paginado/busqueda a backend
3. Falta de rollback
   - Mitigacion: runbook de deploy y rollback por modulo
4. Falta de trazabilidad
   - Mitigacion: correlation_id + auditoria por accion critica

## Entregables minimos de hoy
- `AGENTS.md` actualizado con core de negocio y roles
- `docs/AUDIT-2026-02.md` como linea base de auditoria
- Este plan (`docs/PLAN-120MIN-ARQUITECTURA.md`) como guia de ejecucion inmediata
