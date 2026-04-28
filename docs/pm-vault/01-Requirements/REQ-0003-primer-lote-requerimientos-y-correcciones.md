---
id: REQ-0003
type: requirement
title: Primer lote de requerimientos y correcciones
status: refining
owner: Patroclo
work_type: operational
created: 2026-04-24
updated: 2026-04-25
priority: P1
domain: intake
impacted_apps:
  - docs
stakeholders:
  - producto
  - arquitectura
  - desarrollo
source_links:
  - docs/pm-vault/00-Home.md
depends_on:
  - REQ-0001
  - REQ-0002
related_adrs: []
adr_not_required: true
related_arch_docs:
  - docs/ARCHITECTURE_V2.md
  - docs/pm-vault/05-Architecture/architecture-canon.md
code_refs: []
test_refs: []
release_target: n/a
tags:
  - req
  - intake
  - backlog
---

# REQ-0003 - Primer lote de requerimientos y correcciones

## Problema

El siguiente lote mezcla trabajo nuevo con correcciones. Si entra directo al desarrollo sin filtro, se mezcla backlog funcional con fixes y se pierde trazabilidad frente a Patroclo, Raphael y la documentacion vigente.

## Objetivo

Usar esta nota como intake inicial del primer lote y luego separar cada item concreto en un REQ individual.

## Resultado esperado

- Cada item del lote queda clasificado como `feature` o `bugfix`
- Cada item tiene areas impactadas del repo
- Raphael puede decidir rapido si hace falta ADR
- El backlog operativo ya nace conectado a la vault

## Scope in

- Registrar items candidatos
- Clasificarlos
- Marcar dependencias y riesgo de ADR
- Definir que items se separan primero a REQs implementables

## Scope out

- Implementar los items en esta misma nota
- Mezclar varios cambios no relacionados en un solo REQ listo

## Reproduccion actual

- Solo si `work_type: bugfix`
- No aplica a la nota madre; cada bugfix hijo debe documentarlo

## Reglas de negocio

- No mover un item a `ready` mientras siga ambiguo
- Todo bugfix debe tener reproduccion actual y resultado esperado
- Todo feature debe declarar alcance, reglas de negocio e impacto en arquitectura

## Impacto en el repo

- Apps o paquetes: por definir item a item
- APIs o contratos: por definir item a item
- Datos o migraciones: por definir item a item
- Seguridad o permisos: por definir item a item
- Observabilidad o trazabilidad: esta nota ordena la entrada del backlog

## Gate de arquitectura

- ADR relacionado: por definir item a item
- Si no aplica ADR, justificar `adr_not_required: true` en cada REQ derivado

## Criterios de aceptacion

- [x] El primer lote esta listado abajo
- [x] Cada item tiene `work_type`
- [ ] Los items prioritarios ya fueron separados a REQs individuales
- [x] Los items con posible impacto arquitectonico quedaron marcados para revision de Raphael

## Primer lote en refinamiento

### Features candidatas

- [ ] P0/F1: QR free manual por lotes desde modulo interno, con regla clara `free con limite horario`.
- [ ] P1/F2: Gestion de promotores: editar/desactivar, links, codigos y cortesias.
- [x] P1/F3: Tipos de entradas/lotes: Early, All Night, precios, disponibilidad y mensajes editables.
- [ ] P1/F4: Backoffice usable en celular para operacion en evento.
- [ ] P2/F5: Aforo real y barra de llenado publica/operativa.

### Correcciones candidatas

- [x] Bugfix 01: restaurar gate global de `pnpm check-types` y alinear el test `QRStatsTable`
- [x] Bugfix 02: resolver warning de schema en `layout` sobre `organizers.layout_canvas_width`
- [x] Bugfix 03: ocultar/deshabilitar tarjeta si Culqi no esta listo en runtime
- [x] P0/Bugfix 04: validar reporte confiable para pagar promotores y separar no-show de QR free vs entradas compradas
- [ ] P0/Bugfix 05: distinguir visualmente entrada comprada vs QR free vs cortesia en ticket/backoffice/scan
- [ ] P0/Bugfix 06: validar liberacion de QRs free pendiente antes de prometer salida comercial
- [ ] P1/Bugfix 07: revisar mesas/reservas/cantidad de QRs por mesa contra data real
- [ ] P1/Bugfix 08: corregir precio inicial si carga mostrando lote/precio viejo
- [ ] P2/Bugfix 09: pulidos visuales de logo, textos, etiquetas y scroll

### Items para revision de arquitectura

- [ ] Revisar lenguaje historico "multi-organizer" frente a ADR-007 antes de abrir cambios de tenancy
- [ ] Culqi end-to-end real: requiere decision operativa antes de comunicar "tarjeta funcionando"
- [ ] Reportes/no-show: revisar contrato de datos si se cambia fuente canonica de asistencia o venta
- [ ] QR free/cortesia: definir regla formal `cortesia all night` vs `free con limite horario`

## REQs hijos a crear

- [x] REQ-0004 - restaurar gate global de `check-types`
- [x] REQ-0005 - resolver warning de schema de `layout`
- [x] REQ-0006 - ocultar tarjeta si Culqi no esta listo en runtime
- [x] REQ-0007 - reporte promotor/no-show confiable
- [ ] REQ-0008 - diferenciacion visual QR comprado/free/cortesia
- [ ] REQ-0009 - liberacion QR free por lotes y reglas horarias
- [x] REQ-0010 - tipos de entradas/lotes persistidos por evento

## Evidencia esperada

- Codigo: REQs derivados cuando corresponda
- Tests / checks: por definir en cada item
- Docs / changelog: por definir en cada item

## Riesgos abiertos

- Si se mete demasiada mezcla aqui, el lote pierde valor y hay que partirlo antes de implementar.
