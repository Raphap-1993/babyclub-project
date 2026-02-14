# AUDIT ENDPOINTS + QUERIES (2026-02-13)

## Metadatos
- Fecha: 2026-02-13
- Alcance: `apps/backoffice/app/api`, `apps/landing/app/api`, `packages/api-logic`, flujo `promotores -> codigos de cortesia`
- Metodo: inventario de endpoints + auditoria de queries en repo + remediacion tecnica directa
- Nota: sin `EXPLAIN ANALYZE` en entorno productivo

## Inventario de endpoints
- Backoffice API routes: `73`
- Landing API routes: `20`

Endpoints criticos de negocio auditados:
- Disponibilidad landing: `apps/landing/app/api/events/route.ts`, `apps/landing/app/api/tables/route.ts`, `apps/landing/app/api/tickets/route.ts`
- Pagos: `apps/landing/app/api/payments/culqi/create-order/route.ts`, `apps/landing/app/api/payments/culqi/webhook/route.ts`, `apps/backoffice/app/api/payments/culqi/refund/route.ts`
- Puerta/escaneo: `apps/backoffice/app/api/scan/route.ts`, `apps/backoffice/app/api/scan/confirm/route.ts`
- Promotores/codigos: `apps/backoffice/app/api/promoters/*`, `apps/backoffice/app/api/codes/*`

## Estado semaforo
| Area | Estado | Evidencia |
|---|---|---|
| Dominio y flujos core | Amarillo | Hay endpoints para todos los flujos core, pero con logica de agregacion dispersa (`packages/api-logic/qr-summary.ts`, `packages/api-logic/promoter-summary.ts`). |
| Contratos API | Amarillo | Contratos funcionales, pero coexistian endpoints admin sin guard estricto (`apps/backoffice/app/api/qr-summary-all/route.ts`, `apps/backoffice/app/api/promoter-summary-all/route.ts`). |
| Datos y performance | Amarillo | Se detectaron queries con full-read y N+1 en rutas de resumen/consulta. |
| Seguridad | Amarillo | Se usa `requireStaffRole`, pero no estaba aplicado en todos los endpoints admin de resumen. |
| Observabilidad | Amarillo | Existen logs, falta estandarizar `correlation_id` transversal por request. |

## Hallazgos principales de performance
1. Resumen QR y promotores con agregacion en memoria
- Evidencia: `packages/api-logic/qr-summary.ts`, `packages/api-logic/promoter-summary.ts`.
- Riesgo: crecimiento lineal en RAM/latencia por volumen de tickets.

2. Busqueda de promotores con doble query y filtro `ILIKE` amplio
- Evidencia: `apps/backoffice/app/admin/promoters/page.tsx`.
- Riesgo: degradacion con tablas `persons/promoters` grandes.

3. Endpoints de exportacion/reportes con limites altos
- Evidencia: `apps/backoffice/app/api/admin/tickets/export/route.ts`, `apps/backoffice/app/api/admin/reports/export/route.ts`.
- Riesgo: timeout en picos de datos.

4. N+1 parcial en vistas de tickets (enriquecimiento de relaciones)
- Evidencia: `apps/backoffice/app/admin/tickets/page.tsx`.
- Riesgo: latencia acumulada en listados.

## Cambios aplicados en esta iteracion
### 1) Promotores E2E (menu + flujo friendly)
- Menu habilitado: `apps/backoffice/components/dashboard/Sidebar.tsx`
- Accion directa por promotor: `apps/backoffice/app/admin/promoters/components/PromoterActions.tsx`
- Nueva pantalla E2E de generacion: `apps/backoffice/app/admin/promoters/[id]/codes/page.tsx`
- Cliente de flujo y historial de lotes: `apps/backoffice/app/admin/promoters/[id]/codes/PromoterCodesClient.tsx`
- Edicion con acceso directo a codigos: `apps/backoffice/app/admin/promoters/[id]/edit/page.tsx`

### 2) Endpoint de generacion de codigos robusto
- Reescrito para usar RPC `generate_codes_batch` (auditable, idempotencia operacional por lote):
  `apps/backoffice/app/api/promoters/generate-codes/route.ts`
- Prefijo friendly por `evento + promotor`, validaciones de payload y auth header obligatorio.

### 3) Seguridad en endpoints admin de resumen
- Guard aplicado:
  `apps/backoffice/app/api/qr-summary-all/route.ts`
  `apps/backoffice/app/api/promoter-summary-all/route.ts`
- Clientes dashboard migrados a `authedFetch`:
  `apps/backoffice/components/dashboard/TicketsSummaryCard.tsx`
  `apps/backoffice/components/dashboard/PromotersSummaryCard.tsx`

### 4) Optimizacion SQL estructural
- Nueva migracion:
  `supabase/migrations/2026-02-13-promoters-friendly-codes-and-summary-rpc.sql`
- Incluye:
  - indices para `code_batches`, `codes`, `tickets`, `promoters`
  - indices trigram para busqueda textual (`promoters.code`, `persons full_name`)
  - RPC agregadas:
    - `get_qr_summary_all`
    - `get_promoter_summary_all`

### 5) Consumo de RPC con fallback seguro
- `packages/api-logic/qr-summary.ts`: usa RPC agregada y cae a legacy si la funcion no existe.
- `packages/api-logic/promoter-summary.ts`: usa RPC agregada y cae a legacy si la funcion no existe.

## Buenas practicas propuestas para todo endpoint
- Auth por defecto: usar `requireStaffRole` en todo endpoint admin.
- Query budget: evitar full-read; preferir agregacion SQL (`GROUP BY`, RPC) en vez de agregacion en app.
- Paginacion obligatoria en listados; evitar `count: "exact"` salvo necesidad fuerte.
- Indices parciales alineados a filtros reales (`deleted_at`, `is_active`, `event_id`, `created_at`).
- Respuestas estandarizadas: `success/error` + codigos HTTP consistentes.
- Logs operativos: incluir `correlation_id`, actor (`staff_id`) y entidad afectada.

## Top 5 riesgos abiertos
| Riesgo | Severidad | Owner sugerido | Fecha |
|---|---|---|---|
| Exportaciones con limites altos sin cola async | Alto | Backend + DevOps | 2026-02-20 |
| N+1 en listados de tickets | Alto | Backend | 2026-02-19 |
| Falta de `correlation_id` transversal | Medio | Plataforma | 2026-02-21 |
| Duplicidad de logica entre APIs de landing/backoffice | Medio | Arquitectura | 2026-02-24 |
| Fallback legacy de summaries no removido tras migracion estable | Medio | Tech Lead | 2026-02-27 |
