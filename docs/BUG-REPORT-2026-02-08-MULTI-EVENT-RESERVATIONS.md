# Análisis Flujo Completo: Registro → QR → Visualización (2026-02-08)
## Estado: ✅ CORREGIDO

Fecha de aplicación: 2026-02-08

### Bugs encontrados y reparados
1. ❌ `/ticket/[id]` - Mostraba reserva de mesa de evento anterior
2. ❌ `/api/tickets/delete` - Rechazaba reservas de TODOS los eventos del usuario
## Problema encontrado #2: Reservas de mesa reutilizadas de evento anterior

### Escenario del bug
```
1. Usuario: Rafael (DNI 71020150, Email: rafael@example.com)
2. Evento A (CERRADO): Cumpleaños 2026-02-05
   - Reservó: Mesa 3 con Gin Beefeater Pink
   - Códigos mesa: mesa-3-583537, mesa-3-5c7d58
3. Evento B (ABIERTO): Cumpleaños 2026-03-05
   - Solo generó QR (SIN reservar mesa)

Hoy 2026-02-08:
- Rafael se registra en Evento B con su email
- Sistema genera QR nuevo ✅
- Visualiza ticket...
- MOSTRABA ❌: Mesa 3 + Gin Beefeater Pink + códigos de mesa
  (datos del Evento A cerrado)
- DEBERÍA MOSTRAR ✅: Sin mesa (no reservó en Evento B)
```

## Raíz del problema

### Función `getTicket()` - Línea 89-103
```typescript
// ❌ PROBLEMA: Busca reserva por email/phone sin filtrar por evento
const { data: resv } = await supabase
  .from("table_reservations")
  .select("table:tables(name),product:table_products(name,items)")
  .or(`email.eq.${normalized.email || ""},phone.eq.${normalized.phone || ""}`)
  .order("created_at", { ascending: false })
  .limit(1);  // ← Retorna la MÁS RECIENTE, sin importar evento
```

### Función `getReservationCodesFor()` - Línea 119-135
```typescript
// ❌ PROBLEMA: Busca códigos de mesa por email/phone sin filtro de evento
const { data, error } = await supabase
  .from("table_reservations")
  .select("codes,status,created_at")
  .or(`email.eq.${email || ""},phone.eq.${phone || ""}`)
  .order("created_at", { ascending: false })
  .limit(5);  // ← Busca en cualquier evento
```

## Estructura de datos relevante

### Tabla `table_reservations`
```sql
id (uuid)
event_id (uuid) ← CLAVE FALTANTE EN FILTRO
table_id (uuid)
email (string)
phone (string)
document (string)
status (enum: pending, approved, confirmed, paid, cancelled)
codes (array<string>) -- códigos de mesa asociados
created_at (timestamptz)
updated_at (timestamptz)
deleted_at (timestamptz)
```

## Solución

### Fix 1: Obtener event_id del ticket
Antes de buscar reservas, necesitamos el `event_id` del ticket para filtrar.

```typescript
// En getTicket(), agregamos event_id a la búsqueda
const { data, error } = await supabase
  .from("tickets")
  .select(
    "id,event_id,qr_token,full_name,...",
    // ↑ Agregamos event_id
  )
```

### Fix 2: Filtrar reservas por evento del ticket
```typescript
// ✅ Corrección en getTicket()
if (normalized.email || normalized.phone) {
  const { data: resv } = await supabase
    .from("table_reservations")
    .select("table:tables(name),product:table_products(name,items)")
    .eq("event_id", ticket.event_id) // ← FILTRO CRÍTICO
    .or(`email.eq.${normalized.email || ""},phone.eq.${normalized.phone || ""}`)
    .order("created_at", { ascending: false })
    .limit(1);
```

### Fix 3: Filtrar códigos de mesa por evento
```typescript
// ✅ Corrección en getReservationCodesFor()
export async function getReservationCodesFor(
  ticket: TicketView & { event_id: string }
): Promise<string[]> {
  const { data, error } = await supabase
    .from("table_reservations")
    .select("codes,status,created_at")
    .eq("event_id", ticket.event_id) // ← FILTRO CRÍTICO
    .or(`email.eq.${email || ""},phone.eq.${phone || ""}`)
    .order("created_at", { ascending: false })
    .limit(5);
```

## Flujo correcto después del fix

```
1. Usuario accede a /ticket/ABC123
   ↓
2. Sistema busca ticket
   - SELECT id, event_id, qr_token, ... FROM tickets WHERE id = 'ABC123'
   - Obtiene event_id = "event-B"
   ↓
3. Sistema busca reserva de mesa
   - SELECT ... FROM table_reservations
     WHERE event_id = "event-B"
     AND (email = 'rafael@example.com' OR phone = '...')
     ORDER BY created_at DESC
     LIMIT 1
   - SI: Encuentra reserva en Evento B → Muestra mesa B
   - NO: No encuentra (no reservó) → No muestra mesa
   ↓
4. Sistema busca códigos de mesa
   - SELECT codes FROM table_reservations
     WHERE event_id = "event-B"
     AND (email = '...' OR phone = '...')
   - Retorna solo códigos del Evento B actual
```

## Implicaciones

### Seguridad
- ✅ Usuarios NO ven datos de reservas de otros eventos
- ✅ Datos no se filtra correctamente por organizer

### UX
- ✅ Ticket muestra SOLO info del evento actual
- ✅ Reservas de eventos pasados NO contaminan visualización

### Performance
- ✅ Índice compuesto recomendado: `(event_id, email, phone, created_at DESC)`

## Índice recomendado en Supabase

```sql
-- Búsqueda rápida de reservas por evento + contacto
create index if not exists idx_table_reservations_event_contact 
  on public.table_reservations(event_id, email, phone, created_at desc);

-- Soft delete considerado
create index if not exists idx_table_reservations_event_active 
  on public.table_reservations(event_id, deleted_at, created_at desc)
  where deleted_at is null;
```

## Patrón: Esto es un anti-patrón común

Está repetido en:
1. `/api/persons` - ✅ CORREGIDO (tickets vigentes)
2. `/ticket/[id]` - ❌ NUEVO BUG (reservas vigentes)
3. Probablemente otros endpoints

## Lección para el equipo (AGENTS.md)

**Regla**: En multi-evento, SIEMPRE filtrar por `event_id` cuando busques datos de usuario.

```typescript
// ❌ MAL: Sin event_id
const { data } = await supabase
  .from("table_reservations")
  .select("*")
  .eq("email", email);  // Retorna de TODOS los eventos

// ✅ BIEN: Con event_id
const { data } = await supabase
  .from("table_reservations")
  .select("*")
  .eq("event_id", eventId)
  .eq("email", email);  // Retorna solo del evento actual
```

## Casos de uso impactados

1. **Ticket display** (`/ticket/[id]`) → ✅ CORREGIDO
2. **Ticket delete** (`POST /api/tickets/delete`) → ✅ CORREGIDO
3. **Admin reservas** (`POST /api/admin/reservations`) → ✓ Revisado, OK
4. **Reserva listing** (`GET /api/admin/reservations`) → ✓ Revisado, OK
5. **Compra directa** (`/compra`) → ✓ Usa event_id, OK

## Soluciones implementadas

### Fix 1: `apps/landing/app/ticket/[id]/page.tsx`

✅ Agregado `event_id` al tipo `TicketView`
✅ Agregado `event_id` a la query de búsqueda de ticket
✅ Filtro `event_id` en búsqueda de reserva de mesa
✅ Filtro `event_id` en búsqueda de códigos de mesa

```typescript
// Antes ❌
const { data: resv } = await supabase
  .from("table_reservations")
  .select("...")
  .or(`email.eq.${email},...`) // Sin filtro event_id

// Después ✅
const { data: resv } = await supabase
  .from("table_reservations")
  .select("...")
  .eq("event_id", normalized.event_id) // Filtro event_id
  .or(`email.eq.${email},...`)
```

### Fix 2: `apps/backoffice/app/api/tickets/delete/route.ts`

❌ **BUG**: Rechazaba reservas del usuario en TODOS los eventos
✅ **FIX**: Rechaza solo reservas del evento del ticket que se elimina

```typescript
// Antes ❌
await supabase
  .from("table_reservations")
  .update({ status: "rejected" })
  .or(filters.join(",")) // Sin event_id filter

// Después ✅
await supabase
  .from("table_reservations")
  .update({ status: "rejected" })
  .eq("event_id", eventId) // Filtro event_id
  .or(filters.join(","))
```

### Cambios menores

✅ Corrección de type hint en `apps/backoffice/app/admin/reservations/page.tsx` (línea 127)

## Próximos pasos

1. Crear índice en Supabase para performance:
```sql
create index if not exists idx_table_reservations_event_contact 
  on public.table_reservations(event_id, email, phone, created_at desc);
```

2. Agregar patrón de "buscar por contacto solo en evento actual" en ARCHITECTURE_V2.md
