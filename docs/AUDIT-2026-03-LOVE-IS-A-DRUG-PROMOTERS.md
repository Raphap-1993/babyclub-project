# AUDIT 2026-03 LOVE IS A DRUG PROMOTERS

## Objetivo
Reconstruir que significan realmente los numeros del reporte manual de `LOVE IS A DRUG` y alinearlos con una metrica canonica en BD.

## Conclusión
- Los numeros de la captura de `QRs/cortesias` coinciden con `tickets activos por promotor` para ese evento.
- No coinciden con:
  - `codes` generados por promotor
  - `scan_logs result = valid`
  - `escaneos confirmados`
- Por eso hoy es facil comparar numeros que parecen hablar de lo mismo, pero en realidad miden cosas distintas.

## Evento auditado
- Evento: `LOVE IS A DRUG`
- `event_id`: `ae023aee-5754-4d1b-a2f5-d5d3603bbfcc`
- Fecha de corte: `2026-03-11`
- Fuente: snapshot real de Supabase con `service_role`

## Reconciliación directa con tu captura
La captura muestra este patron:
- William `18`
- Villegas `15`
- Cielo `14`
- Alexandra `12`
- Alexander `11`

En la BD, esos mismos valores aparecen exactamente al medir `tickets activos` por promotor:

| Promotor | `tickets_active` | `tickets_used` | `scans_confirmed` | `codes_total` |
|---|---:|---:|---:|---:|
| Williams Aylas | `18` | `7` | `7` | `13` |
| Jose Villegas | `15` | `9` | `9` | `14` |
| Cielo Razuri Mera | `14` | `3` | `3` | `7` |
| Alexandra Dos Santos | `12` | `8` | `8` | `8` |
| Alexander Bartolo | `11` | `3` | `3` | `10` |

## Hallazgo principal
- El “reporte manual” estaba leyendo `QRs/cortesias asignadas/emitidas` por promotor.
- En terminos de BD, para este evento eso equivale a:
  - `tickets.deleted_at is null`
  - `tickets.is_active = true`
  - agrupado por `ticket.promoter_id` o fallback `code.promoter_id`

## Por que aparecen otros numeros en otros lados
Porque hoy conviven varias metricas con el mismo lenguaje operativo.

## Metrica 1. `QRs/cortesias`
### Qué es
- Accesos emitidos y activos por promotor

### Qué tabla manda
- `tickets`

### Definicion canonica
- `tickets_active`

### Uso recomendado
- “Cuantos accesos/cortesias tiene cargados este promotor para este evento”

## Metrica 2. `Validados`
### Qué es
- Ingresos realmente confirmados en puerta

### Qué tabla manda
- `tickets.used = true`
- o `scan_logs` confirmados, deduplicados

### Definicion canonica
- `tickets_used`

### Uso recomendado
- “Cuantas personas efectivamente entraron”

## Metrica 3. `Lecturas validas`
### Qué es hoy
- Mezcla de pre-check y confirmacion

### Qué tabla manda
- `scan_logs`

### Problema
- duplica la realidad operativa
- no debe usarse como metrica de ingreso

## Metrica 4. `Códigos generados`
### Qué es
- Lotes emitidos en `codes`

### Problema
- no siempre equivalen a QR final emitido
- ademas, promotor y cortesia se mezclan por legacy

## Diagnóstico de negocio
Para nightlife / eventos como BabyClub, la forma correcta de pensar el flujo es:

1. `Asignado / emitido`
- cuantos accesos tiene el promotor
- metrica: `tickets_active`

2. `Ingresado`
- cuantos realmente entraron
- metrica: `tickets_used`

3. `Conversion`
- ingresado / asignado
- formula: `tickets_used / tickets_active`

No deberias mezclar eso con:
- `codes_total`
- `scan_logs valid`

## Regla canonica recomendada
### Para promotores
- `assigned_qr_count = tickets_active`
- `used_qr_count = tickets_used`
- `attendance_rate = used_qr_count / assigned_qr_count`

### Para puerta
- `confirmed_entries = tickets_used`
- `scan_logs` queda como auditoria operativa, no como KPI principal

### Para marketing/comercial
- `assigned_qr_count` puede ser la cifra que conversa el promotor
- `used_qr_count` es la cifra para payout, performance y postmortem

## Inconsistencias de diseño que explican el ruido
### 1. Promotor y cortesia se mezclan en `codes.type`
- La RPC de lotes degrada `promoter` a `courtesy`
- Eso rompe reportes por tipo comercial

### 2. `scan_logs.valid` no representa ingresos
- incluye pre-check
- incluye confirmacion

### 3. `codes` y `tickets` no son la misma unidad
- un codigo puede existir sin representar el KPI operativo final
- el ticket es mas cercano a la unidad real de admision

## Recomendacion concreta
## KPI oficial por promotor
Usar solo estas columnas en reportes:
- `qrs_asignados = tickets_active`
- `qrs_ingresados = tickets_used`
- `conversion_pct = qrs_ingresados / qrs_asignados`

## No usar como KPI oficial
- `codes_total`
- `scan_logs where result = 'valid'`

## Cambio funcional recomendado
Renombrar en UI:
- `QRs/cortesias` -> `QRs asignados`
- `Validados` -> `Ingresaron`

Eso baja muchisimo la ambiguedad.

## Script de reconciliación
Se agregó:
- `scripts/audit-promoter-metrics.js`

Ejemplo:
```bash
node scripts/audit-promoter-metrics.js --event-name "LOVE IS A DRUG"
```

El script devuelve por promotor:
- `codes_total`
- `codes_active`
- `codes_inactive`
- `tickets_total`
- `tickets_active`
- `tickets_used`
- `scans_confirmed`
- `scan_precheck_valid_logs`

## Dictamen final
- Tu captura no estaba “mal”.
- El problema es que el sistema hoy permite comparar peras con manzanas.
- Para este rubro, la metrica correcta por promotor debe ser:
  - `asignado`
  - `ingresado`
  - `conversion`
- Si normalizas eso, los reportes dejan de pelearse con la BD y pasan a hablar el mismo idioma operativo.
