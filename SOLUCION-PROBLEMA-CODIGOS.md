# Cómo Resolver el Problema de Edición de Códigos

## TL;DR (Resumen rápido)

Tu problema es que la tabla `codes` tiene un constraint `UNIQUE` global en la columna `code`, cuando debería ser `UNIQUE` por evento. Esto causa que al editar códigos se vean comportamientos inconsistentes.

**Solución:** Aplicar la migración que corrige el constraint.

---

## Diagnóstico Rápido

### Paso 1: Verificar si tienes el problema

Ejecuta en Supabase SQL Editor:

```sql
-- ¿Hay códigos duplicados entre eventos?
SELECT code, COUNT(DISTINCT event_id) as eventos
FROM public.codes
WHERE deleted_at IS NULL
GROUP BY code
HAVING COUNT(DISTINCT event_id) > 1;
```

Si esta query retorna filas, **tienes el problema**.

### Paso 2: Ver detalles con el script de auditoría

```bash
cd /Users/rapha/Projects/babyclub-monorepo
node scripts/audit-db-codes.js
```

Esto te mostrará:
- Códigos duplicados activos
- Eventos con múltiples códigos generales
- Estadísticas generales
- Recomendación de acción

---

## Solución Paso a Paso

### Opción A: Aplicar migración en Supabase Studio (Recomendado)

1. Abre [Supabase Studio](https://supabase.com/dashboard)
2. Ve a tu proyecto → SQL Editor
3. Copia y pega el contenido de: `supabase/migrations/2026-02-08-fix-code-uniqueness.sql`
4. Haz clic en **Run**
5. Verifica que veas el mensaje: `✅ Migración exitosa: unicidad de códigos por evento garantizada`

### Opción B: Aplicar migración desde CLI (Avanzado)

```bash
# Si usas Supabase CLI
supabase db push

# O aplicar manualmente
psql $DATABASE_URL -f supabase/migrations/2026-02-08-fix-code-uniqueness.sql
```

---

## Verificación Post-Migración

### 1. Verificar que no hay duplicados

```sql
-- No debe retornar ninguna fila
SELECT code, event_id
FROM public.codes
WHERE deleted_at IS NULL AND is_active = true
GROUP BY code, event_id
HAVING COUNT(*) > 1;
```

### 2. Probar edición de código

1. Ve al backoffice → Eventos
2. Edita un evento y cambia su código
3. Guarda
4. Vuelve a editar el mismo evento
5. ✅ Debes ver el código que acabas de guardar

### 3. Ejecutar script de auditoría nuevamente

```bash
node scripts/audit-db-codes.js
```

Debes ver: `✅ ESTADO: SALUDABLE`

---

## Qué Hace la Migración

La migración realiza estos cambios seguros:

1. **Cleanup de duplicados**: Marca códigos duplicados antiguos como soft-deleted
2. **Remueve constraint UNIQUE global**: Elimina `codes_code_key`
3. **Crea índice parcial**: `UNIQUE (code, event_id)` excluyendo soft-deletes
4. **Actualiza función**: `set_event_general_code()` ahora excluye soft-deletes correctamente
5. **Agrega índices de performance**: Para mejorar velocidad de queries

**Downtime requerido:** NINGUNO  
**Riesgo de rollback:** BAJO (solo índices, no datos)  
**Duración estimada:** < 5 segundos

---

## Documentación Completa

Para entender el problema en profundidad, lee:

- **Reporte completo**: [docs/DB-INCONSISTENCIES-REPORT-2026-02-08.md](./docs/DB-INCONSISTENCIES-REPORT-2026-02-08.md)
- **Contexto del bug**: [docs/BUG-2026-02-08-EVENT-CODE-ARCHITECTURE.md](./docs/BUG-2026-02-08-EVENT-CODE-ARCHITECTURE.md)
- **Migración SQL**: [supabase/migrations/2026-02-08-fix-code-uniqueness.sql](./supabase/migrations/2026-02-08-fix-code-uniqueness.sql)

---

## Rollback (Si algo sale mal)

Si después de aplicar la migración tienes problemas:

```sql
-- 1. Restaurar UNIQUE global (solo temporal)
ALTER TABLE public.codes ADD CONSTRAINT codes_code_key UNIQUE (code);

-- 2. Remover índices nuevos
DROP INDEX IF EXISTS codes_unique_per_event;
DROP INDEX IF EXISTS codes_one_active_general_per_event;
```

Luego reporta el problema al equipo técnico.

---

## Preguntas Frecuentes

### ¿Por qué pasó esto?

El constraint original `code UNIQUE` se implementó cuando solo había un evento activo. Con multi-evento, este constraint es demasiado restrictivo.

### ¿Se perderán datos?

NO. La migración solo hace soft-delete de duplicados antiguos. Todos los datos se mantienen, solo se marcan como `deleted_at`.

### ¿Afecta a usuarios finales?

NO. Esta migración solo afecta la lógica interna del backoffice. Los usuarios finales no verán ningún cambio.

### ¿Cuándo debo aplicarla?

Lo antes posible. Cada vez que editas un código de evento, el problema puede empeorar.

### ¿Puedo aplicarla en producción directamente?

SÍ, es segura. Pero si eres conservador:
1. Aplica primero en local/staging
2. Verifica con `audit-db-codes.js`
3. Si todo OK, aplica en producción

---

## Contacto

Si tienes dudas o problemas:
1. Lee el reporte completo en [docs/DB-INCONSISTENCIES-REPORT-2026-02-08.md](./docs/DB-INCONSISTENCIES-REPORT-2026-02-08.md)
2. Ejecuta el script de auditoría y comparte el output
3. Contacta al Tech Lead o Arquitecto con evidencia
