# Flujo End-to-End: Reservas de Mesas

**Fecha:** 2026-02-09  
**Versión:** 1.0  
**Objetivo:** Documentar el flujo completo de reservas de mesas desde la creación hasta la validación en puerta

---

## 🎯 Resumen Ejecutivo

El sistema de reservas de mesas permite:
- Reservar mesas para eventos específicos
- Asociar códigos QR a las reservas
- Validar entradas en puerta
- Gestionar estados (pendiente, confirmada, cancelada)

---

## 📊 Actores del Sistema

| Actor | Rol | Acciones Permitidas |
|-------|-----|---------------------|
| **Admin** | Administrador | Crear, editar, confirmar, cancelar reservas |
| **Cliente** | Usuario final | Ver sus reservas, recibir códigos QR |
| **Puerta** | Operador de escaneo | Validar códigos QR de entrada |
| **Organizador** | Dueño del evento | Ver reservas de sus eventos |

---

## 🔄 Flujo Principal: Creación de Reserva

### 1. Inicio: Solicitud de Reserva

**Entrada:**
- Mesa disponible (`table_id`)
- Datos del cliente (`full_name`, `email`, `phone`)
- Evento asociado (`event_id`)
- Producto/combo opcional (`product_id`)

**Validaciones:**
```typescript
// 1. Mesa existe y está activa
const table = await supabase
  .from("tables")
  .select("id, name, event_id, is_active")
  .eq("id", table_id)
  .single();

if (!table.is_active) {
  throw new Error("Mesa inactiva");
}

// 2. No hay reserva activa en la mesa
const existingReservation = await supabase
  .from("table_reservations")
  .select("id")
  .eq("table_id", table_id)
  .in("status", ["pending", "confirmed", "paid"])
  .maybeSingle();

if (existingReservation) {
  throw new Error("Mesa ya reservada");
}

// 3. Producto pertenece a la mesa (si aplica)
if (product_id) {
  const product = await supabase
    .from("table_products")
    .select("id, table_id")
    .eq("id", product_id)
    .single();
    
  if (product.table_id !== table_id) {
    throw new Error("Producto no pertenece a la mesa");
  }
}
```

**Salida:**
- Reserva creada con estado `pending` o `approved`
- Registro en `table_reservations`

---

### 2. Confirmación de Reserva

**Entrada:**
- `reservation_id`
- Cantidad de entradas (`ticket_quantity`)

**Proceso:**
```typescript
// 1. Actualizar estado a "confirmed"
await supabase
  .from("table_reservations")
  .update({ 
    status: "confirmed",
    ticket_quantity: ticket_quantity 
  })
  .eq("id", reservation_id);

// 2. Generar códigos QR
const codes = await generateCourtesyCodes({
  count: ticket_quantity,
  eventId: event_id,
  fullName: reservation.full_name,
  email: reservation.email
});

// 3. Asociar códigos a la reserva
await supabase
  .from("table_reservations")
  .update({ codes: codes })
  .eq("id", reservation_id);

// 4. Enviar email con códigos QR
await sendReservationEmail({
  to: reservation.email,
  codes: codes,
  eventName: event.name,
  tableName: table.name
});
```

**Salida:**
- Reserva confirmada
- Códigos QR generados y enviados
- Email de confirmación enviado

---

### 3. Validación en Puerta

**Entrada:**
- Código QR escaneado

**Proceso:**
```typescript
// 1. Buscar código
const code = await supabase
  .from("event_codes")
  .select(`
    id,
    is_used,
    event:events(id, name, date),
    reservation:table_reservations(id, full_name, table_name)
  `)
  .eq("code", scannedCode)
  .single();

// 2. Validaciones
if (code.is_used) {
  throw new Error("Código ya usado");
}

if (code.event.date !== today) {
  throw new Error("Código no válido para hoy");
}

// 3. Marcar como usado
await supabase
  .from("event_codes")
  .update({ 
    is_used: true,
    used_at: new Date().toISOString()
  })
  .eq("id", code.id);

// 4. Registrar en logs
await logScanEvent({
  code_id: code.id,
  reservation_id: code.reservation.id,
  scanned_at: new Date(),
  success: true
});
```

**Salida:**
- Entrada validada
- Cliente puede ingresar
- Log de escaneo registrado

---

## 🗂️ Modelo de Datos

### Tabla: `table_reservations`

```sql
CREATE TABLE table_reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_id UUID NOT NULL REFERENCES tables(id),
  event_id UUID REFERENCES events(id),
  ticket_id UUID REFERENCES tickets(id),
  
  -- Datos del cliente
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  
  -- Producto/combo (opcional)
  product_id UUID REFERENCES table_products(id),
  
  -- Estado
  status TEXT NOT NULL DEFAULT 'pending',
  -- pending, approved, confirmed, rejected, cancelled
  
  -- Códigos QR generados
  codes TEXT[],
  ticket_quantity INTEGER,
  
  -- Metadata
  voucher_url TEXT,
  notes TEXT,
  created_by_staff_id UUID,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Índices Importantes

```sql
-- Búsqueda por mesa
CREATE INDEX idx_table_reservations_table_id 
  ON table_reservations(table_id);

-- Búsqueda por evento
CREATE INDEX idx_table_reservations_event_id 
  ON table_reservations(event_id);

-- Soft delete
CREATE INDEX idx_table_reservations_deleted_at 
  ON table_reservations(deleted_at);

-- Estado activo
CREATE INDEX idx_table_reservations_status 
  ON table_reservations(status) 
  WHERE deleted_at IS NULL;
```

---

## 🔒 Reglas de Negocio

### 1. Una Mesa, Una Reserva Activa

```typescript
// No se permite duplicar reservas activas
const ACTIVE_STATUSES = ["pending", "approved", "confirmed", "paid"];

const existingReservation = await supabase
  .from("table_reservations")
  .select("id")
  .eq("table_id", table_id)
  .in("status", ACTIVE_STATUSES)
  .is("deleted_at", null)
  .maybeSingle();

if (existingReservation) {
  throw new Error("Mesa ya tiene reserva activa");
}
```

### 2. Códigos Únicos por Evento

```typescript
// Cada código debe ser único globalmente
const code = generateUniqueCode(); // ej: "BC-ABC123"

const exists = await supabase
  .from("event_codes")
  .select("id")
  .eq("code", code)
  .maybeSingle();

if (exists) {
  // Regenerar código
  code = generateUniqueCode();
}
```

### 3. No Reingreso

```typescript
// Un código solo puede usarse una vez
if (code.is_used) {
  throw new Error("Código ya utilizado");
}

// Marcar como usado es irreversible (sin soft delete)
await supabase
  .from("event_codes")
  .update({ is_used: true, used_at: now() })
  .eq("id", code.id);
```

### 4. Cancelación vs Eliminación

```typescript
// CANCELAR: cambia estado pero preserva datos
await supabase
  .from("table_reservations")
  .update({ status: "cancelled" })
  .eq("id", reservation_id);

// ELIMINAR: soft delete (auditable)
await supabase
  .from("table_reservations")
  .update({ 
    deleted_at: now(),
    deleted_by: user_id,
    is_active: false
  })
  .eq("id", reservation_id);
```

---

## 📡 API Endpoints

### POST `/api/admin/reservations`
Crear nueva reserva (admin)

**Modos:**
- `new_customer`: Cliente nuevo
- `existing_ticket`: Asociar a ticket existente

**Body:**
```json
{
  "mode": "new_customer",
  "table_id": "uuid",
  "event_id": "uuid",
  "full_name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "987654321",
  "product_id": "uuid",
  "status": "approved",
  "codes": ["CODE1", "CODE2"],
  "notes": "VIP"
}
```

### PATCH `/api/admin/reservations/update`
Actualizar reserva existente

**Body:**
```json
{
  "id": "uuid",
  "status": "confirmed",
  "ticket_quantity": 4
}
```

### DELETE `/api/admin/reservations/delete`
Soft delete de reserva

**Body:**
```json
{
  "id": "uuid"
}
```

### GET `/api/admin/reservations`
Listar todas las reservas (server component)

**Query:**
- Automático: incluye joins con `tables`, `events`, `organizers`

---

## 🎨 UI: Columnas de la Tabla

### Columnas Visibles (Optimizadas)

| Columna | Contenido | Justificación |
|---------|-----------|---------------|
| **Cliente** | Nombre + Email | Identificación principal |
| **Teléfono** | Número de contacto | Comunicación rápida |
| **Evento & Mesa** | Evento + Mesa | Contexto de la reserva |
| **Entradas** | Cantidad de códigos QR | Estado de tickets |
| **Estado** | Badge visual | Estado actual |
| **Acciones** | Botón "Ver" | Acceso a detalles |

### Columnas Eliminadas (Redundantes)

❌ **Organizador** - Se filtra desde arriba  
❌ **Contacto combinado** - Email ya está en Cliente  
❌ **Ticket Quantity** - Se muestra en Entradas  

---

## 🔍 Filtros Disponibles

1. **Búsqueda por texto** (nombre, email, teléfono)
2. **Rango de fechas** (desde/hasta)
3. **Organizador** (dropdown)
4. **Estado** (pending, confirmed, cancelled)

---

## 📊 Métricas en Dashboard

```typescript
{
  total: reservations.length,
  filtradas: filteredReservations.length,
  confirmadas: reservations.filter(r => r.status === "confirmed").length,
  pendientes: reservations.filter(r => r.status === "pending").length,
  codigos: reservations.reduce((sum, r) => sum + (r.codes?.length || 0), 0)
}
```

---

## ⚠️ Puntos Críticos

### 1. Idempotencia en Generación de Códigos
- Si se reintenta la confirmación, no duplicar códigos
- Verificar si `codes` ya existe antes de generar

### 2. Sincronización Mesa-Evento
- Una mesa puede cambiar de evento
- Validar coherencia al crear reserva

### 3. Soft Delete Consistente
- Nunca eliminar físicamente
- Mantener `deleted_at` para auditoría

### 4. Rate Limiting en Escaneo
- Prevenir escaneos masivos accidentales
- Implementar throttle de 1 escaneo/segundo por código

---

## 🚀 Mejoras Futuras

1. **Notificaciones Push** cuando se confirma reserva
2. **QR dinámicos** con refresh cada 30 segundos
3. **Reservas parciales** (confirmar solo algunas entradas)
4. **Historial de cambios** por reserva
5. **Export a Excel** de reservas filtradas

---

## 📝 Checklist de Testing

- [ ] Crear reserva nueva
- [ ] Crear reserva con ticket existente
- [ ] Confirmar reserva genera códigos
- [ ] Email de confirmación se envía
- [ ] No se puede duplicar reserva en misma mesa
- [ ] Producto debe pertenecer a la mesa
- [ ] Soft delete preserva datos
- [ ] Filtros funcionan correctamente
- [ ] Escaneo marca código como usado
- [ ] No se puede usar código dos veces
- [ ] Códigos solo válidos para evento correcto

---

## 🔗 Referencias

- [API de Reservas](/apps/backoffice/app/api/admin/reservations/route.ts)
- [Componente Cliente](/apps/backoffice/app/admin/reservations/ModernReservationsClient.tsx)
- [Schema DB](/supabase/migrations)
- [RBAC Matrix](/docs/RBAC-MATRIX-2026-02.md)
- [Arquitectura V2](/docs/ARCHITECTURE_V2.md)
