# Changelog: Códigos Amigables de Reservas (Friendly Reservation Codes)

**Fecha:** 2026-02-09  
**Tipo:** Feature Enhancement  
**Modulos afectados:** Reservas de Mesas, Base de Datos, Backoffice, Landing  

## Problema Original
1. **Códigos de reserva:** Mostraban UUIDs largos e imposibles de comunicar:
   ```
   40bd38c5-f5ab-45bc-8a41-a5eb259ad455
   ```

2. **Códigos de mesa:** Generados con formato no amigable (`EFED3090`, `EFED8388`)

3. **Falta de aprobación visible:** El sistema tenía lógica de aprobación pero no estaba visible en la UI

4. **Sin email automático:** No se enviaba email transaccional al aprobar reserva

## Solución Implementada

### 1. **Migración de Base de Datos**
**Archivo:** `supabase/migrations/2026-02-09-add-friendly-code-to-reservations.sql`

- Nuevo campo: `friendly_code` (text, único, indexado)
- Índice único para prevenir duplicados: `table_reservations_friendly_code_unique`
- Índice de búsqueda: `table_reservations_friendly_code_idx`
- Comentario descriptivo en la columna

```sql
alter table public.table_reservations
  add column if not exists friendly_code text;

create unique index if not exists table_reservations_friendly_code_unique 
  on public.table_reservations(friendly_code) 
  where friendly_code is not null;
```

### 2. **API de Reservas - Landing**
**Archivo:** `apps/landing/app/api/reservations/route.ts`

#### Generación de Código Amigable:
```typescript
// Toma primeras 4 letras del nombre del evento
const eventName = "San Valentin" → friendlyBase = "LOVE"
const friendlyCode = `${friendlyBase}${randomNum}` // "LOVE1234"
```

#### Características:
- ✅ Retry logic (hasta 5 intentos) si hay colisión de códigos
- ✅ Genera código único por reserva
- ✅ Los códigos de mesa (para invitados) también usan el mismo formato
- ✅ Backward compatible: retorna `friendlyCode` como `reservationId`

### 3. **Códigos de Mesa (Invitados) Friendly**
Ahora los códigos generados para cada ticket de la mesa también son amigables:

**Antes:**
```
EFED3090
EFED8388
EFED2796
```

**Ahora:**
```
LOVE1234
LOVE5678
LOVE9012
```

### 4. **Backoffice - Visualización**
**Archivos modificados:**
- `apps/backoffice/app/api/admin/reservations/[id]/route.ts`
- `apps/backoffice/app/admin/reservations/page.tsx`
- `apps/backoffice/app/admin/reservations/components/ViewReservationModal.tsx`

#### Cambios en la UI:
1. **Modal de detalle:** Muestra `friendly_code` en badge destacado al lado del estado
2. **Listado:** Incluye `friendly_code` en los datos de cada reserva
3. **Consultas SQL:** Todas las queries ahora incluyen el campo `friendly_code`

### 5. **Sistema de Aprobación (Ya existente, ahora documentado)**
**Archivo:** `apps/backoffice/app/admin/reservations/components/ReservationActions.tsx`

El botón de "Aprobar" YA EXISTE y está funcional:
- ✅ Cambia estado de `pending` → `approved`
- ✅ Genera tickets automáticos
- ✅ Envía email transaccional con códigos QR
- ✅ Muestra feedback de éxito/error

**Email incluye:**
- Código de reserva friendly
- Todos los códigos de mesa (con QR)
- Detalles del evento
- Link de ayuda

### 6. **Formato de Códigos - Ejemplos Reales**

```typescript
// Eventos y sus códigos generados:
"San Valentin"     → "LOVE1234" (reserva) + "LOVE5678", "LOVE9012" (invitados)
"Baby Shower"      → "BABY1234" (reserva) + "BABY5678", "BABY9012" (invitados)
"Noche de Gala"    → "NOCH1234" (reserva) + "NOCH5678", "NOCH9012" (invitados)
"Love is a Drug"   → "LOVE1234" (reserva) + "LOVE5678", "LOVE9012" (invitados)
"Mesa 123"         → "MESA1234" (fallback si no hay evento)
```

## Beneficios

### Para el Cliente:
- ✅ Códigos fáciles de recordar: `LOVE1234` vs `40bd38c5-f5ab-45bc-8a41-a5eb259ad455`
- ✅ Fácil de comunicar por teléfono/WhatsApp
- ✅ Identificación visual del tipo de evento
- ✅ Email automático con QR al aprobar

### Para Operaciones:
- ✅ Búsqueda rápida por código amigable (indexado)
- ✅ Menos errores al dictar códigos
- ✅ Proceso de aprobación claro y trazable
- ✅ Logs de emails enviados

### Técnico:
- ✅ Prevención de duplicados con retry logic
- ✅ Backward compatible (frontend usa `mesaReservationId`)
- ✅ Índices optimizados para búsqueda
- ✅ Migración aditiva (no destructiva)

## Archivos Modificados

### Nuevos:
- ✅ `supabase/migrations/2026-02-09-add-friendly-code-to-reservations.sql`
- ✅ `docs/CHANGELOG-2026-02-09-friendly-reservation-codes.md`

### Modificados:
- ✅ `apps/landing/app/api/reservations/route.ts` (genera friendly_code)
- ✅ `apps/backoffice/app/api/admin/reservations/[id]/route.ts` (SELECT friendly_code)
- ✅ `apps/backoffice/app/admin/reservations/page.tsx` (tipo + query)
- ✅ `apps/backoffice/app/admin/reservations/components/ViewReservationModal.tsx` (UI badge)

## Testing

### 1. Aplicar Migración (Producción)
```bash
cd /Users/rapha/Projects/babyclub-monorepo
npx supabase db push --linked
```

### 2. Probar Creación de Reserva (Landing)
```bash
# Ir a http://localhost:3001/compra
# 1. Seleccionar mesa
# 2. Llenar formulario
# 3. Subir voucher
# 4. Enviar reserva
# Verificar: Modal debe mostrar "LOVE1234" en lugar de UUID
```

### 3. Probar Aprobación (Backoffice)
```bash
# Ir a http://localhost:3000/admin/reservations
# 1. Click en "Ver" de una reserva pendiente
# 2. Verificar que aparece código amigable al lado del estado
# 3. Click en "Aprobar"
# 4. Verificar email recibido con QR codes friendly
```

### 4. Verificar en BD
```sql
SELECT 
  id, 
  friendly_code, 
  full_name, 
  status,
  codes,
  created_at 
FROM table_reservations 
ORDER BY created_at DESC 
LIMIT 10;

-- Resultado esperado:
-- friendly_code: "LOVE1234", "BABY5678", etc.
-- codes: ["LOVE5678", "LOVE9012", ...]
```

### 5. Test de Unicidad
```sql
-- Verificar que no hay duplicados
SELECT 
  friendly_code, 
  COUNT(*) as count
FROM table_reservations
WHERE friendly_code IS NOT NULL
GROUP BY friendly_code
HAVING COUNT(*) > 1;

-- Resultado esperado: 0 filas
```

## Impacto

| Área | Impacto | Detalles |
|------|---------|----------|
| **UI/UX** | ⭐⭐⭐⭐⭐ | Mejora dramática en experiencia de cliente |
| **Soporte** | ⭐⭐⭐⭐⭐ | Códigos fáciles de dictar y verificar |
| **Base de Datos** | ⭐⭐⭐ | Nuevo campo + 2 índices |
| **Performance** | ⭐ | Mínimo (generación random + retry) |
| **Operaciones** | ⭐⭐⭐⭐⭐ | Proceso de aprobación más claro |
| **Email** | ⭐⭐⭐⭐ | Automático con Resend al aprobar |

## Próximos Pasos (Opcional)

- [ ] **Prefijo personalizado por organizador:** Permitir que cada organizador configure su prefijo (ej: `COLO` para Colorimetría)
- [ ] **SMS de confirmación:** Enviar código por SMS además de email
- [ ] **Búsqueda por friendly_code:** Panel de búsqueda rápida en backoffice
- [ ] **QR directo:** Generar QR del friendly_code para mostrar en puerta
- [ ] **Analytics:** Trackear uso de códigos amigables vs búsqueda manual

## Notas de Implementación

### Retry Logic Explicada:
```typescript
// Si hay colisión de código (23505 = unique violation)
// Se reintenta hasta 5 veces con nuevo random
while (insertAttempts < 5) {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  friendlyCode = `${friendlyBase}${randomNum}`;
  // INSERT...
  if (!error) break;
  if (error.code === "23505") continue; // retry
}
```

### Email Transaccional:
El sistema YA ENVIABA emails al aprobar. Esta mejora solo documenta y asegura que los códigos mostrados sean amigables.

```typescript
// En /api/reservations/update (línea ~104)
if (updateData.status === "approved") {
  // 1. Crear tickets
  // 2. Enviar email con sendTicketEmail()
  // 3. Si es mesa, enviar sendApprovalEmail() con códigos
}
```

## Conclusión

Esta mejora transforma la experiencia de reserva de "imposible de comunicar" a "simple y memorable":

**Antes:** "Tu código es cuatro-cero-be-de-tres-ocho-ce-cinco-guión-efe-cinco-a-be..."  
**Ahora:** "Tu código es LOVE-uno-dos-tres-cuatro" ✨
