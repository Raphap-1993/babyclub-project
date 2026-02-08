# Multi-Evento y Lógica de Cierre (2026-02)

## Estado actual: ✅ CORREGIDO

Fecha de aplicación: 2026-02-08

## Contexto del problema
Al cerrar un evento, los tickets/códigos del usuario del evento anterior siguen siendo detectados como "vigentes" cuando el usuario vuelve a registrarse. Esto causa que se muestre "VER MI QR" en lugar de "GENERAR QR".

### Escenario actual
1. Usuario se registra en **Evento A** (Ej: Cumpleaños 2026-02-05)
2. Sistema crea ticket y QR para el Evento A
3. Admin cierra **Evento A** (via `POST /api/events/close`)
4. Usuario intenta registrarse nuevamente con su DNI
5. Sistema DEBE mostrar "GENERAR QR" (nuevo ticket)
6. Sistema ESTÁ MOSTRANDO "VER MI QR" (reutiliza ticket viejo)

## Raíz del problema

### 1) Cierre de evento incompleto
**Archivo**: [apps/backoffice/app/api/events/close/route.ts](apps/backoffice/app/api/events/close/route.ts)

```typescript
const { error: codesError } = await supabase
  .from("codes")
  .update({ is_active: false })
  .eq("event_id", id)
  .eq("is_active", true);
```

✅ Al cerrar evento, se desactivan los códigos activos del evento.

❌ **PERO** también hay que validar que los tickets del evento cerrado no se reutilicen.

### 2) Búsqueda de ticket sin validar evento activo
**Archivo**: [apps/landing/app/api/persons/route.ts](apps/landing/app/api/persons/route.ts#L136-L152)

**Problema**: El fallback (línea 136-152) busca el último ticket **sin filtrar por evento activo**.

```typescript
// ❌ PROBLEMA: Sin validar que el evento esté activo
const latestTicketQuery = applyNotDeleted(
  supabase
    .from("tickets")
    .select("id,promoter_id,event_id")
    .or(fallbackTicketQuery)
    .order("created_at", { ascending: false })
    .limit(1)
);
```

**Debería ser**:
```typescript
// ✅ CORRECCIÓN: Filtrar solo tickets de eventos activos
const latestTicketQuery = applyNotDeleted(
  supabase
    .from("tickets")
    .select("id,promoter_id,event_id,event:event_id(is_active,closed_at)")
    .or(fallbackTicketQuery)
    .eq("event:is_active", true) // ← FALTA ESTO
    .order("created_at", { ascending: false })
    .limit(1)
);
```

### 3) Flujo de búsqueda de tickets en landing
**Archivo**: [apps/landing/app/api/tickets/route.ts](apps/landing/app/api/tickets/route.ts)

También necesita validar que el evento está activo ANTES de permitir crear un nuevo ticket.

```typescript
// En POST /api/tickets:
// Si el usuario ya tiene ticket del evento actual -> error "Ya tienes entrada"
// Si el usuario tiene ticket de evento CERRADO -> permitir nuevo ticket
```

## Estructura de datos actual

### Tabla `events`
```sql
- id (uuid)
- name (string)
- is_active (boolean) ← Se pone FALSE al cerrar
- closed_at (timestamptz) ← Fecha de cierre
- closed_by (uuid) ← Staff que cerró
- deleted_at (timestamptz) ← Soft delete
```

### Tabla `codes`
```sql
- id (uuid)
- event_id (uuid)
- is_active (boolean) ← Se pone FALSE al cerrar evento
```

### Tabla `tickets`
```sql
- id (uuid)
- event_id (uuid)
- dni (string)
- document (string)
- code_id (uuid)
- is_active (boolean)
- deleted_at (timestamptz)
```

## Reglas de negocio confirmadas (AGENTS.md + ARCHITECTURE_V2.md)

### Multi-evento
- Un usuario PUEDE tener múltiples tickets en eventos diferentes
- Un usuario NO PUEDE tener múltiples tickets en el MISMO evento activo

### Cierre de evento
- Cuando se cierra evento:
  - ✅ `is_active = false`
  - ✅ `closed_at = now()`
  - ✅ Todos los `codes` del evento → `is_active = false`
  - ❌ NO borramos tickets (soft delete, trazabilidad)
  - ❌ Los tickets del evento cerrado NO se reutilizan

### Búsqueda de tickets vigentes
- Vigente = ticket de un evento que **sigue activo**
- No vigente = ticket de evento cerrado, expirado, o eliminado
- Fallback debe respetar esto

## Plan de corrección

### ✅ Paso 1: Corregir `/api/persons` fallback
**Archivo**: [apps/landing/app/api/persons/route.ts](apps/landing/app/api/persons/route.ts#L130-L152)

**Cambio**: El fallback ahora:
- Busca UP TO 10 tickets (no solo 1) para encontrar uno de evento activo
- Valida que `event.is_active === true` y `event.closed_at` es NULL
- Solo retorna tickets de eventos activos
- Ignora tickets de eventos cerrados/inactivos

```typescript
// ANTES ❌
const latestTicketQuery = applyNotDeleted(
  supabase
    .from("tickets")
    .select("id,promoter_id,event_id")
    .or(fallbackTicketQuery)
    .order("created_at", { ascending: false })
    .limit(1) // Retorna el primero sin validar evento
);

// DESPUÉS ✅
const latestTicketQuery = applyNotDeleted(
  supabase
    .from("tickets")
    .select("id,promoter_id,event_id,event:event_id(is_active,closed_at)")
    .or(fallbackTicketQuery)
    .order("created_at", { ascending: false })
    .limit(10) // Busca en los 10 más recientes
);
const { data: latestTickets } = await latestTicketQuery;

// Buscar el primer ticket cuyo evento esté activo
for (const ticket of latestTickets || []) {
  const eventRel = Array.isArray((ticket as any).event) 
    ? (ticket as any).event?.[0] 
    : (ticket as any).event;
  
  if (eventRel && eventRel.is_active === true && !eventRel.closed_at) {
    ticketId = (ticket as any)?.id;
    break;
  }
}
```

### ✅ Paso 2: Corregir `/api/tickets` POST
**Archivo**: [apps/landing/app/api/tickets/route.ts](apps/landing/app/api/tickets/route.ts#L80-L100)

**Cambios**:

a) **Validar evento activo antes de crear**: 
- Lee evento de BD
- Rechaza si `is_active = false` o `closed_at` tiene valor
- Retorna error HTTP 400

b) **Filtrar tickets existentes por evento activo**:
- Busca tickets del usuario para el evento
- Valida que el evento sigue activo
- Si evento está cerrado, permite crear nuevo ticket (continúa flujo)
- Si evento está activo, retorna ticket existente

```typescript
// VALIDACIÓN DE EVENTO ACTIVO
if (eventId) {
  const { data: eventRow } = await supabase
    .from("events")
    .select("id,is_active,closed_at")
    .eq("id", eventId)
    .maybeSingle();

  if (!eventRow || eventRow.is_active === false || eventRow.closed_at) {
    return NextResponse.json({ success: false, error: "Evento cerrado o inactivo" }, { status: 400 });
  }
}

// FILTRO DE TICKET EXISTENTE
const existingTicketQuery = applyNotDeleted(
  supabase
    .from("tickets")
    .select("id,qr_token,event_id,event:event_id(is_active,closed_at)")
    .eq("event_id", eventId)
    .eq("person_id", person_id)
    .limit(1)
);

if (existingTicket?.id && existingTicket.qr_token) {
  const eventRel = Array.isArray((existingTicket as any).event)
    ? (existingTicket as any).event?.[0]
    : (existingTicket as any).event;
  
  // Solo reutilizar si evento sigue activo
  if (eventRel && eventRel.is_active === true && !eventRel.closed_at) {
    return NextResponse.json({
      success: true,
      existing: true,
      ticketId: existingTicket.id,
      qr: existingTicket.qr_token,
    });
  }
  // Si evento cerrado, permitir nuevo ticket
}
```

### ✅ Paso 3: Tests agregados
**Archivo**: [apps/landing/app/api/tickets/route.test.ts](apps/landing/app/api/tickets/route.test.ts)

Tests agregados:
1. ✅ "crea ticket free con código válido" (corregido con mock de evento activo)
2. ✅ "rechaza crear ticket si el evento está cerrado" (nuevo test)

```
Test Files  14 passed (14)
Tests       37 passed (37)
```

### Paso 4: Documentar en ARCHITECTURE_V2.md

## Endpoints impactados
1. `POST /api/events/close` - Cierre de evento ✅ OK (desactiva códigos)
2. `GET /api/persons?document=...&code=...` - **❌ FALLBACK BUG**
3. `POST /api/tickets` - Crear ticket (debe validar evento)
4. `GET /api/aforo?code=...` - Disponibilidad (probablemente ok)
5. `GET /api/codes/info?code=...` - Info de código

## Summary (Caso de uso crítico)
```
Caso: Cumpleaños mensual con mismo DNI
- Usuario: Rafael (DNI: 71020150)
- Evento A: Cumpleaños 2026-02-05 (CERRADO)
- Evento B: Cumpleaños 2026-03-05 (ABIERTO, nuevo código diferente)

Hoy: 2026-02-08
- Usuario accede a landing con código del Evento B
- Ingresa DNI 71020150
- Sistema DEBE mostrar: "GENERAR QR" (nuevo ticket Evento B)
- Sistema SÍ ESTABA MOSTRANDO: "VER MI QR" (ticket viejo Evento A)

Raíz: `/api/persons` fallback retorna ticket más reciente sin filtrar por evento activo
```
