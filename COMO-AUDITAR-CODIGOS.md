# Cómo Auditar el Estado de Códigos en tu BD

## ⚡ Opción 1: SQL Directo en Supabase Studio (MÁS FÁCIL)

1. Abre [Supabase Studio](https://supabase.com/dashboard)
2. Ve a tu proyecto → **SQL Editor**
3. Copia y pega este query simple:

```sql
-- AUDITORÍA RÁPIDA: Estado de códigos duplicados

-- 1️⃣ ¿Hay códigos duplicados entre eventos?
SELECT 
  code,
  COUNT(DISTINCT event_id) as eventos_diferentes,
  COUNT(*) as total_registros,
  STRING_AGG(DISTINCT e.name, ', ') as eventos
FROM public.codes c
LEFT JOIN public.events e ON e.id = c.event_id
WHERE c.deleted_at IS NULL
GROUP BY code
HAVING COUNT(DISTINCT event_id) > 1
ORDER BY total_registros DESC;

-- 2️⃣ ¿Hay eventos con múltiples códigos generales?
SELECT 
  e.name as evento,
  COUNT(*) as cantidad_codigos,
  STRING_AGG(c.code, ', ') as codigos
FROM public.codes c
JOIN public.events e ON e.id = c.event_id
WHERE c.type = 'general'
  AND c.is_active = true
  AND c.deleted_at IS NULL
GROUP BY e.name
HAVING COUNT(*) > 1;

-- 3️⃣ Estadísticas generales
SELECT
  COUNT(*) as total_codigos,
  COUNT(CASE WHEN deleted_at IS NULL THEN 1 END) as activos,
  COUNT(CASE WHEN deleted_at IS NOT NULL THEN 1 END) as soft_deleted
FROM public.codes;

-- 4️⃣ Resumen: ¿Necesito la migración?
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM public.codes 
      WHERE deleted_at IS NULL 
      GROUP BY code 
      HAVING COUNT(DISTINCT event_id) > 1
    ) THEN '🔴 SÍ - Hay códigos duplicados entre eventos'
    ELSE '✅ NO - Estado saludable'
  END as necesita_migracion;
```

4. Haz clic en **Run**
5. Revisa los resultados:
   - Si la query 1 retorna filas → **tienes el problema**
   - Si la query 4 dice "🔴 SÍ" → **aplica la migración**

---

## 🔧 Opción 2: Script Node.js (Requiere configuración)

### Configurar variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto:

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key  # Opcional pero recomendado
```

### Ejecutar el script

```bash
node scripts/audit-db-codes.js
```

---

## 🎯 Aplicar la Migración (Si es necesario)

Si la auditoría muestra que necesitas la migración:

### Paso 1: Copia la migración
Abre el archivo: `supabase/migrations/2026-02-08-fix-code-uniqueness.sql`

### Paso 2: Ejecuta en Supabase Studio
1. Ve a **SQL Editor**
2. Pega el contenido completo
3. Haz clic en **Run**
4. Espera a ver: `✅ Migración exitosa: unicidad de códigos por evento garantizada`

### Paso 3: Verifica
Ejecuta la auditoría de nuevo (Opción 1 o 2) para confirmar que el problema se resolvió.

---

## ❓ ¿Por qué falla el script Node.js?

El script necesita conectarse a Supabase, pero no encuentra las variables de entorno. Opciones:

1. **Crear `.env.local`** (como se muestra arriba)
2. **Usar Opción 1** (SQL directo) que no requiere configuración
3. **Exportar variables temporalmente**:
   ```bash
   export NEXT_PUBLIC_SUPABASE_URL="https://..."
   export NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
   node scripts/audit-db-codes.js
   ```

---

## 📋 Resumen Rápido

```
┌─────────────────────────────────────────────────────┐
│ PROBLEMA: Código se edita pero al abrir muestra    │
│           otro código diferente                      │
│                                                      │
│ CAUSA: Constraint UNIQUE global en tabla codes      │
│                                                      │
│ SOLUCIÓN:                                           │
│   1. Auditar con SQL en Supabase Studio            │
│   2. Si hay problemas, aplicar migración            │
│   3. Verificar de nuevo                             │
└─────────────────────────────────────────────────────┘
```

**Recomendación:** Usa la **Opción 1 (SQL Directo)** - es más rápida y no requiere configuración.
