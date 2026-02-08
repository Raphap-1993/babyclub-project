# AGENTS.md

## Objetivo
Este documento define como trabaja el equipo tecnico de BabyClub para:
- entregar features con calidad y velocidad
- auditar la arquitectura actual sin frenar el negocio
- migrar de V1 a V2 de forma segura

## Contexto actual del proyecto
- Monorepo con Turborepo + pnpm
- Apps principales: `apps/landing` (publico) y `apps/backoffice` (admin)
- Base de datos: Supabase (Postgres + Storage + Auth)
- Deploy: Vercel desde Git
- Enfoque tecnico definido: Strangler V1 -> V2 (ver `docs/ARCHITECTURE_V2.md` y `docs/STRANGLER_PLAN.md`)
- Objetivo comercial inmediato: venta online con pasarela de pago Peru (Culqi)

## Core de negocio confirmado (2026-02)
- Venta de entradas online por evento
- Venta de box/mesas con combo obligatorio (administrable y categorizable)
- Venta directa en mesa durante evento (operacion onsite)
- Flujo critico no negociable: disponibilidad de la landing publica
- Flujos tambien criticos: pagos y escaneo en puerta

### Reglas de negocio invariantes
- Limites de uso por codigo
- Limite de hora de ingreso aplica solo a codigos generales
- Codigos especiales sin restriccion de hora limite
- No se permite reingreso
- No se permite duplicidad de QR

### Decisiones operativas confirmadas (2026-02)
- Pasarela principal: `Culqi`
- Comprobante digital obligatorio desde dia 1
- Reembolso/anulacion: via Culqi (panel/API), con control desde backoffice cuando exista `charge_id`
- SLA objetivo de validacion en puerta: `<= 2s`
- No existe contingencia offline en puerta (requiere alta disponibilidad)
- Multi-marca/multi-organizador en la misma plataforma (sin subdominios)
- Marketing de cumpleanos permitido con consentimiento explicito
- Toda accion relevante debe quedar auditada

## Roles reales y permisos base
- `admin`: control total (configuracion, seguridad, operaciones, anulaciones)
- `puerta`: solo lectura/uso del modulo de escaneo QR
- `promotor`: participa en flujo comercial, sin acceso a panel admin interno
- `moso`: acceso operativo a carta virtual/ventas permitidas en evento
- `cajero`: puede cobrar con restricciones; anulaciones requieren autorizacion superior
- `cliente_final`: registro, compra, tickets y consultas propias

## Principios de trabajo
- API-first y contratos versionados
- Cambios de BD aditivos (sin borrado destructivo)
- Idempotencia en flujos criticos (tickets, pagos, escaneo)
- Seguridad por defecto (auth, roles, rate limit, soft delete)
- Observabilidad desde el diseno (logs, correlation_id, trazabilidad)
- Cambios pequenos, reversibles y medibles

## Roles y responsabilidades
Si el equipo es pequeno, una persona puede cubrir varios roles, pero las responsabilidades siguen separadas.

### PM (Product Manager)
- Define objetivos de negocio, alcance y prioridad
- Mantiene roadmap y criterios de aceptacion
- Decide trade-offs de alcance/fecha junto a Arquitecto y Tech Lead
- Entregables por sprint:
  - backlog priorizado
  - criterios de aceptacion por historia
  - riesgos y dependencias visibles

### Arquitecto de Software
- Define arquitectura objetivo y reglas no negociables
- Valida boundaries de modulos y contratos entre capas
- Aprueba decisiones de alto impacto (ADR)
- Entregables por sprint:
  - ADRs nuevas o actualizadas
  - evaluacion de deuda tecnica/riesgo
  - plan de evolucion V1 -> V2 por modulo

### Analista de Sistemas
- Traduce reglas de negocio a especificaciones testables
- Mantiene mapa de procesos, datos y casos borde
- Alinea negocio, PM, dev y QA sobre comportamiento esperado
- Entregables por sprint:
  - historias refinadas con flujo feliz y excepciones
  - definicion de datos de entrada/salida
  - matriz de reglas por modulo

### Developers
- Implementan cambios en codigo, tests y migraciones
- Mantienen contratos API y compatibilidad
- Reportan riesgos tecnicos temprano
- Entregables por sprint:
  - PRs pequenas con pruebas y notas tecnicas
  - migraciones seguras cuando aplique
  - actualizacion de docs tecnicas

### QA
- Define estrategia de prueba por riesgo
- Asegura cobertura funcional y regresion
- Verifica criterios de aceptacion antes de release
- Entregables por sprint:
  - plan de pruebas por historia
  - evidencia de validacion (manual/automatizada)
  - reporte de defectos y severidad

### DevOps
- Mantiene pipeline CI/CD, ambientes y secretos
- Define observabilidad, alertas y runbooks
- Asegura trazabilidad de deploys y rollback
- Entregables por sprint:
  - estado de pipelines
  - calidad de deploy (tiempo, exito, rollback)
  - mejoras de seguridad operativa

## Cadencia sugerida (semanal)
- Lunes: planning + refinamiento tecnico
- Diario: sync de 15 min (bloqueos y riesgos)
- Mitad de sprint: checkpoint arquitectura/QA
- Fin de sprint: demo + retro + estado de deuda tecnica

## Definition of Ready (DoR)
Una historia entra a desarrollo solo si cumple:
- objetivo de negocio claro
- criterios de aceptacion concretos y medibles
- impacto tecnico identificado (apps, API, BD, seguridad)
- dependencias y riesgos visibles
- estrategia de prueba definida por QA

## Definition of Done (DoD)
Una historia se considera terminada solo si:
- cumple criterios funcionales
- tests pasan local/CI
- no rompe contratos existentes o se versiona el cambio
- incluye migracion segura si toca BD
- incluye observabilidad minima (logs y errores trazables)
- tiene evidencia QA y aprobacion final

## Flujo operativo por cambio
1. Descubrimiento: PM + Analista + Arquitecto
2. Diseno: contrato API, modelo de datos, riesgos, ADR
3. Implementacion: dev en rama corta con PR pequena
4. Validacion: QA funcional + regresion + smoke checks
5. Release: deploy controlado con verificacion post-deploy
6. Cierre: metricas, lecciones y ajustes

## Gate tecnico minimo por PR
- Ejecutar:
  - `pnpm test`
  - `pnpm lint`
  - `pnpm check-types`
- Si cambia BD:
  - migracion en `supabase/migrations/`
  - script reversible o plan de rollback documentado
  - validacion de impacto en datos historicos
- Si cambia API:
  - contrato documentado y compatible con V1 (o versionado)
  - casos de error y codigos HTTP definidos

## Marco de auditoria de arquitectura
Usar este checklist para auditar el estado actual y priorizar mejoras.

### 1) Dominio y limites de modulos
- Hay bounded contexts claros (Identity, Events, Codes, Tickets, Scan, Reservations, Payments, Notifications)
- Reglas de negocio criticas no estan duplicadas en multiples apps
- Dependencias entre modulos son explicitas

### 2) API y contratos
- Endpoints publicos/admin tienen contratos estables
- Existe estrategia de versionado (`/api` actual y `/v2/*` objetivo)
- Errores estandarizados e idempotencia donde aplica

### 3) Datos y migraciones
- Migraciones son aditivas y auditables
- Soft delete consistente en tablas criticas
- Indices y constraints soportan reglas de negocio

### 4) Seguridad
- Auth y roles obligatorios en rutas admin
- Rate limit en rutas publicas sensibles
- Secretos gestionados por ambiente, nunca en repo

### 5) Calidad y pruebas
- Cobertura minima en rutas criticas (tickets, scan, reservas)
- Regresion automatizada para flujos core
- QA tiene evidencia reproducible por release

### 6) Operacion y observabilidad
- Logs estructurados con correlation_id
- Monitoreo de errores y alertas accionables
- Runbook de incidente y rollback probado

### 7) CI/CD y gobernanza
- Pipeline con gates reales (test, lint, types, build)
- Convencion de ramas y PR reviews clara
- ADRs y docs actualizadas junto al codigo

## Escala de riesgo (semaforo)
- Verde: controlado, sin bloqueos importantes
- Amarillo: riesgo medio, requiere plan y fecha de cierre
- Rojo: riesgo alto, afecta release o confiabilidad

## Roadmap recomendado de migracion (V1 -> V2)
Basado en `docs/STRANGLER_PLAN.md`.

### Fase 0: Baseline (1 semana)
- Inventario de endpoints V1 y owners
- Linea base de metricas (errores, latencia, incidentes)
- Backlog de deuda tecnica priorizado por riesgo

### Fase 1: Estabilizar V1 (2 a 3 semanas)
- Estandarizar manejo de errores y logs
- Completar cobertura de tests en rutas criticas
- Asegurar politicas de soft delete e idempotencia

### Fase 2: Preparar V2 modular (2 a 4 semanas)
- Crear `apps/api-v2` (o `apps/core-api`)
- Extraer capa de dominio a `packages/domain`
- Extraer acceso a datos a `packages/db`

### Fase 3: Migracion por modulos (iterativa)
- 1. Door Scanning (`/v2/scan`)
- 2. Tickets & QR (`/v2/tickets`)
- 3. Reservations + Tables
- 4. Payments (Culqi)
- 5. Notifications

### Fase 4: Cierre de V1 (cuando KPIs lo permitan)
- Feature flags apagadas gradualmente
- Endpoints legacy deprecados con fecha
- Documentacion final y runbooks de operacion

## Decision records (ADR)
Cada decision tecnica relevante debe registrar:
- contexto
- alternativas evaluadas
- decision tomada
- consecuencias y rollback

Guardar ADRs en `docs/adr/` (crear carpeta si aun no existe).

## KPI minimos para gestionar el equipo
- Lead time por historia
- Frecuencia de deploy
- Tasa de fallo en cambios
- MTTR (tiempo medio de recuperacion)
- Bugs en produccion por release

## Proximo paso sugerido para iniciar la auditoria
Crear un documento `docs/AUDIT-YYYY-MM.md` con:
- estado semaforo por cada area del checklist
- evidencia concreta (archivo, PR, endpoint, test, dashboard)
- top 5 riesgos con owner y fecha compromiso
