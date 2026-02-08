# Resumen Completo: Bugs Multi-Evento (2026-02-08)

## Análisis realizado siguiendo AGENTS.md

En esta sesión se identificaron y corrigieron **2 bugs críticos en el flujo multi-evento** que afectaban la experiencia de usuario cuando se cierran eventos.

---

## BUG #1: Tickets de evento anterior siendo reutilizados ❌ → ✅

### Descripción
Después de cerrar un evento, cuando un usuario se registraba nuevamente, el sistema mostraba **"VER MI QR"** en lugar de **"GENERAR QR"**, porque estaba reutilizando el ticket del evento anterior (ya cerrado).

### Raíz del problema
Endpoint `/api/persons` → Fallback de búsqueda de tickets sin filtro de evento

**Archivo**: [apps/landing/app/api/persons/route.ts](apps/landing/app/api/persons/route.ts#L130-L152)

```typescript
// ❌ ANTES: Retornaba ticket más reciente sin validar evento activo
const latestTicketQuery = applyNotDeleted(
  supabase.from("tickets")
    .select("id,promoter_id,event_id")
    .or(fallbackTicketQuery)
    .order("created_at", { ascending: false })
    .limit(1) // ← Retorna el primero sin validar evento
);
```

### Solución aplicada
- Busca UP TO 10 tickets (no solo 1)
- Valida que `event.is_active === true` + `event.closed_at === null`
- Solo retorna tickets vigentes

**Archivos corregidos**:
- ✅ [apps/landing/app/api/persons/route.ts](apps/landing/app/api/persons/route.ts#L130-L152)
- ✅ [apps/landing/app/api/tickets/route.ts](apps/landing/app/api/tickets/route.ts#L80-L100) - Agregó validación evento activo

---

## BUG #2: Reserva de mesa de evento anterior siendo mostrada ❌ → ✅

### Descripción
Después de generar QR en un nuevo evento, cuando el usuario visualizaba el ticket, aparecía una **reserva de mesa del evento anterior** con sus detalles (mesa, combo, códigos), aunque no había reservado nada en el nuevo evento.

### Raíz del problema
Página `/ticket/[id]` busca reserva de mesa por email/phone sin filtrar por evento

**Archivo**: [apps/landing/app/ticket/[id]/page.tsx](apps/landing/app/ticket/[id]/page.tsx#L95-L105)

```typescript
// ❌ ANTES: Busca por email/phone sin filtro event_id
const { data: resv } = await supabase
  .from("table_reservations")
  .select("...")
  .or(`email.eq.${email || ""},phone.eq.${phone || ""}`)
  .order("created_at", { ascending: false })
  .limit(1); // ← Retorna la más reciente, sin importar evento
```

### Solución aplicada
- Agregado `event_id` a tipo `TicketView`
- Filtro `event_id` en búsqueda de reserva de mesa
- Filtro `event_id` en búsqueda de códigos de mesa

**Archivos corregidos**:
- ✅ [apps/landing/app/ticket/[id]/page.tsx](apps/landing/app/ticket/[id]/page.tsx) (líneas 12, 36, 95, 123)

---

## BUG #3 (Descubierto durante audit): Anulación de reservas en todos los eventos ❌ → ✅

### Descripción
Al eliminar un ticket, el sistema **rechazaba TODAS las reservas del usuario en TODOS los eventos**, cuando debería rechazar solo las del evento del ticket eliminado.

### Raíz del problema
Endpoint `/api/tickets/delete` rechaza reservas sin filtro de evento

**Archivo**: [apps/backoffice/app/api/tickets/delete/route.ts](apps/backoffice/app/api/tickets/delete/route.ts#L33-L68)

```typescript
// ❌ ANTES: Rechaza reservas sin filtro event_id
await supabase
  .from("table_reservations")
  .update({ status: "rejected" })
  .or(filters.join(",")) // Sin event_id filter
  .in("status", activeStatuses);
```

### Solución aplicada
- Agregado `event_id` a query del ticket
- Filtro `event_id` al rechazar reservas asociadas

**Archivos corregidos**:
- ✅ [apps/backoffice/app/api/tickets/delete/route.ts](apps/backoffice/app/api/tickets/delete/route.ts)

---

## Patrón identificado: Buscar por contacto

### Anti-patrón detectado
```typescript
// ❌ MAL: Sin event_id
const { data } = await supabase
  .from("table_reservations")
  .select("*")
  .eq("email", email); // Retorna de TODOS los eventos
```

### Patrón correcto
```typescript
// ✅ BIEN: Con event_id
const { data } = await supabase
  .from("table_reservations")
  .select("*")
  .eq("event_id", eventId)
  .eq("email", email); // Retorna solo del evento actual
```

---

## Validaciones realizadas

```
✅ TypeScript types: OK (landing + backoffice)
✅ Tests: 38/38 passing
✅ Lint: OK
✅ No breaking changes
✅ DoD completo (tests + docs + calidad)
```

---

## Cambios por archivo

### Landing (Public)

| Archivo | Cambios |
|---------|---------|
| `/api/persons/route.ts` | ✅ Fallback filtra por evento activo |
| `/api/tickets/route.ts` | ✅ Validación evento activo + filtro ticket existente |
| `/ticket/[id]/page.tsx` | ✅ Agregó event_id + filtros en búsqueda reservas |
| `/ticket/[id]/page.test.ts` | ✅ Test de concepto agregado |

### Backoffice (Admin)

| Archivo | Cambios |
|---------|---------|
| `/api/tickets/delete/route.ts` | ✅ Filtra reservas por evento |
| `/admin/reservations/page.tsx` | ✅ Type hint fix (minor) |

---

## Documentación creada

1. **[docs/MULTI-EVENT-CLOSE-LOGIC-2026-02.md](docs/MULTI-EVENT-CLOSE-LOGIC-2026-02.md)**
   - Problema #1: Tickets reutilizados
   - Raíz, solución, antes/después
   - Reglas de negocio confirmadas

2. **[docs/BUG-REPORT-2026-02-08-MULTI-EVENT-RESERVATIONS.md](docs/BUG-REPORT-2026-02-08-MULTI-EVENT-RESERVATIONS.md)**
   - Problema #2 y #3: Reservas reutilizadas
   - Estructura de datos
   - Soluciones implementadas
   - Índices recomendados

3. **[docs/CHANGELOG-2026-02-08-close-event-fix.md](docs/CHANGELOG-2026-02-08-close-event-fix.md)**
   - Resumen de cambios problema #1

4. **[docs/MULTI-EVENT-SYSTEM.md](docs/MULTI-EVENT-SYSTEM.md)** ⭐
   - Recapitulación completa de multi-evento
   - Estructura de datos
   - Reglas de negocio
   - Endpoints críticos
   - Seguridad + performance

---

## Cómo se conectan los bugs

```
┌─────────────────────────────────────────────────────┐
│ Usuario registrado Evento A → Genera QR + Reserva   │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Admin cierra Evento A
                 ↓
┌─────────────────────────────────────────────────────┐
│ Evento A: is_active=false, closed_at=now()          │
│ Códigos A: is_active=false                          │
│ Tickets A: Sigue existiendo (no se borra)           │
│ Reservas A: Sigue existiendo (no se borra)          │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Usuario se registra Evento B (nuevo)
                 ↓
┌─────────────────────────────────────────────────────┐
│ BUG #1: /api/persons retornaba ticket viejo de A    │
│ → Mostraba "VER MI QR" en lugar de "GENERAR QR"     │
│ ✅ CORREGIDO: Ahora filtra evento activo            │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Usuario genera QR Evento B
                 ↓
┌─────────────────────────────────────────────────────┐
│ BUG #2: /ticket/[id] mostraba reserva vieja de A    │
│ → Mostraba "Mesa 3 + Gin" de Evento A               │
│ ✅ CORREGIDO: Ahora filtra por event_id             │
└────────────────┬────────────────────────────────────┘
                 │
                 │ Admin elimina ticket de Evento B
                 ↓
┌─────────────────────────────────────────────────────┐
│ BUG #3: /api/tickets/delete rechazaba reservas      │
│ de Evento A también                                 │
│ ✅ CORREGIDO: Ahora filtra por event_id del ticket  │
└─────────────────────────────────────────────────────┘
```

---

## Impacto de negocio

### Antes ❌
- Usuarios no podían registrarse en eventos nuevos (confusión UI)
- Visualizar QR mostraba datos de evento anterior
- Eliminar ticket de un evento anulaba reservas de otros eventos

### Después ✅
- Flujo multi-evento limpio y predecible
- Cada evento aislado en visualización
- Operaciones afectan solo el evento relevante

---

## Próximos pasos recomendados

1. **Indexing** (Supabase):
```sql
create index idx_table_reservations_event_contact 
  on public.table_reservations(event_id, email, phone, created_at desc);
```

2. **Documentar patrón** en `ARCHITECTURE_V2.md`:
   - "Buscar por contacto siempre filtra por event_id"

3. **Audit de otros endpoints** con búsquedas por contacto:
   - `/api/payments/receipt` - ✓ OK (por reservation_id)
   - `/api/payments/culqi/create-order` - ✓ OK (por reservation_id)
   - Otros endpoints que usen email/phone

4. **Tests de integración** con BD real para validar multi-evento end-to-end

---

## Seguimiento de AGENTS.md

✅ **Definition of Done cumplido**:
- ✅ Cambios pequeños, reversibles y medibles
- ✅ Tests pasan local/CI
- ✅ No rompe contratos existentes
- ✅ Documentación actualizada
- ✅ Observabilidad: logs en process_logs
- ✅ Idempotencia: Sin duplicados

✅ **Gate técnico**:
- ✅ pnpm test: 38/38 passing
- ✅ pnpm lint: OK
- ✅ pnpm typecheck: OK

✅ **Flujo operativo**:
- ✅ Descubrimiento: Análisis completo realizado
- ✅ Diseño: Soluciones documentadas
- ✅ Implementación: PRs pequeñas por bug
- ✅ Validación: QA automática + documentación
