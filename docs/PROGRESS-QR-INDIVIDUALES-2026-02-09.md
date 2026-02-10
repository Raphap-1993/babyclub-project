# Implementación Códigos Individuales QR - Progress Log
**Fecha:** 2026-02-09  
**Feature:** Sistema de códigos friendly individuales por persona en reservas de mesa

---

## ✅ Completado (10 minutos)

### 1. Migraciones de Base de Datos
**Archivos creados:**
- `/supabase/migrations/2026-02-09-add-codes-reservation-tracking.sql`
- `/supabase/migrations/2026-02-09-add-event-prefix.sql`
- `/supabase/MANUAL-MIGRATION-2026-02-09.sql` (script consolidado para ejecutar en Supabase Dashboard)

**Cambios en BD:**
```sql
-- codes table
+ table_reservation_id uuid FK → table_reservations(id)
+ person_index integer (1-10)
+ indexes for efficient lookups

-- events table  
+ event_prefix text (2-10 chars, uppercase)
```

**Estado:** ⚠️ Pendiente de ejecutar en Supabase Dashboard (CLI no instalada localmente)

---

### 2. Funciones de Generación de Códigos Friendly
**Archivo creado:** `/packages/shared/src/utils/friendly-codes.ts`

**Funciones:**
- `generateFriendlyCode(eventPrefix, tableName, personIndex)` → `"BC-LOVE-M1-001"`
- `parseFriendlyCode(code)` → `{ eventPrefix, tableName, personIndex }`
- `generateReservationCodes(eventPrefix, tableName, quantity)` → `["BC-LOVE-M1-001", ...]`

**Ejemplo:**
```ts
const codes = generateReservationCodes("LOVE", "Mesa 1", 4);
// ["BC-LOVE-M1-001", "BC-LOVE-M1-002", "BC-LOVE-M1-003", "BC-LOVE-M1-004"]
```

---

### 3. Función de Inserción en BD
**Archivo modificado:** `/apps/backoffice/app/api/reservations/utils.ts`

**Nueva función:**
```ts
createReservationCodes(supabase, {
  eventId,
  eventPrefix,
  tableName,
  reservationId,
  quantity
}) → { codes: string[], codeIds: string[] }
```

**Features:**
- Genera N códigos friendly
- Inserta en `codes` table con `table_reservation_id` y `person_index`
- Retorna arrays de códigos y IDs para usar en email/ticket

---

## 🔄 En Progreso (Siguiente paso)

### 4. Actualizar Endpoint POST /api/admin/reservations
**Cambios necesarios:**
1. Fetch event data con `event_prefix`
2. Llamar a `createReservationCodes()` en lugar de `generateCourtesyCodes()`
3. Guardar `codes` array en `table_reservations.codes` (backward compatibility)
4. Pasar códigos individuales a función de email

**Archivo:** `/apps/backoffice/app/api/admin/reservations/route.ts`

---

## 📋 Pendiente

### 5. Email Template con QR Images (15 min)
- Generar QR por cada código individual
- Layout de grid/lista con N códigos
- Usar API de QR Server o similar
- Update de `sendReservationEmail()` en route.ts

### 6. Landing Page /mi-reserva (30 min)
- Crear página en `/apps/landing/app/mi-reserva/page.tsx`
- Input DNI para buscar reserva
- Mostrar QR codes descargables
- Link sutil en footer

### 7. Testing End-to-End (20 min)
- Crear reserva manual desde backoffice
- Verificar códigos en BD con person_index
- Verificar email con N QR codes
- Escanear códigos en /scan

---

## 🎯 Próxima Acción Inmediata

**EJECUTAR MIGRACIÓN:**
1. Ir a Supabase Dashboard → SQL Editor
2. Copiar contenido de `/supabase/MANUAL-MIGRATION-2026-02-09.sql`
3. Ejecutar script
4. Verificar con queries al final del archivo

**Luego:** Actualizar endpoint POST para usar `createReservationCodes()`

---

## 📊 Estimaciones vs Realidad

| Tarea | Estimado | Real | Status |
|-------|----------|------|--------|
| DB Migration | 2 min | 10 min | ✅ Done (script listo) |
| Friendly Codes Utils | 5 min | 5 min | ✅ Done |
| Endpoint Update | 10 min | - | 🔄 Next |
| Email Template | 15 min | - | ⏳ Pending |
| Landing Page | 30 min | - | ⏳ Pending |

---

## 🔑 Decisiones Técnicas (ADR)

### ADR-001: Formato de Código Friendly
**Decisión:** `BC-{EVENT_PREFIX}-{TABLE}-{PERSON_INDEX}`  
**Razón:** 
- Fácil de leer para clientes
- Trazable a evento y mesa
- Único por persona en reserva
- Compatible con escaneo QR

**Ejemplo:** `BC-LOVE-M1-001` = BabyClub, Evento Love Party, Mesa 1, Persona #1

### ADR-002: person_index en lugar de person_id
**Decisión:** Usar índice numérico (1-N) en lugar de FK a persons  
**Razón:**
- Más simple para el MVP
- No todos los asistentes tienen registro previo en persons
- Mantiene orden de códigos predecible
- Facilita generación de códigos secuenciales

### ADR-003: events.event_prefix como campo editable
**Decisión:** Campo text editable vs generado automáticamente  
**Razón:**
- Permite control manual del branding
- Auto-populated en migración desde nombre de evento
- Marketing puede personalizar (ej: "LOVE" vs "AMOR")

---

## 📝 Notas de Implementación

### Compatibilidad hacia atrás
- Campo `table_reservations.codes` se mantiene (json array)
- Códigos legacy sin `table_reservation_id` siguen funcionando
- Nuevas reservas usan ambos sistemas (transición suave)

### Performance
- Índices compuestos en `(table_reservation_id, person_index)`
- WHERE clauses optimizadas para códigos con reserva

### Seguridad
- Validación de `person_index` (1-10) en check constraint
- Cascade delete: si se borra reserva, se borran códigos

---

## 🐛 Issues Encontrados

1. **CLI Supabase no instalada** → Solución: Script manual SQL
2. **Import path** → Usar `shared/utils/friendly-codes` (ya configurado en monorepo)

---

## 🚀 Go-Live Checklist

- [ ] Ejecutar migración en Supabase
- [ ] Actualizar endpoint POST
- [ ] Probar creación de reserva
- [ ] Verificar códigos en BD
- [ ] Email con QR codes
- [ ] Landing /mi-reserva
- [ ] Smoke test scan en puerta
- [ ] Update docs/RESERVAS-QR-INDIVIDUALES-2026-02.md
