# Multi-Evento y Organización (2026-02)

## Resumen de funcionalidad
BabyClub soporta **múltiples eventos al mes** de **múltiples organizadores** en la misma plataforma sin subdominios.

## Estructura de datos

### Tabla `organizers`
```sql
id (uuid)
slug (string, unique) -- ej: "cumple-club", "events-pro"
name (string)
is_active (boolean)
sort_order (integer)
created_at (timestamptz)
deleted_at (timestamptz) -- soft delete
```

### Tabla `events`
```sql
id (uuid)
organizer_id (uuid) -- foreign key
name (string)
code (string) -- código general del evento (ej: "CUMPLE-2026-02")
is_active (boolean) -- true = evento abierto, false = cerrado/inactivo
starts_at (timestamptz)
entry_limit (integer) -- límite de hora para ingreso general
closed_at (timestamptz) -- fecha de cierre del evento
closed_by (uuid) -- staff que cerró
close_reason (text) -- motivo del cierre
capacity (integer) -- aforo total
deleted_at (timestamptz) -- soft delete
```

### Tabla `codes`
```sql
id (uuid)
event_id (uuid) -- foreign key
code (string)
type (enum) -- 'general', 'courtesy', 'promoter', 'table'
promoter_id (uuid)
is_active (boolean)
max_uses (integer)
uses (integer)
expires_at (timestamptz)
created_at (timestamptz)
batch_id (uuid)
deleted_at (timestamptz) -- soft delete
```

### Tabla `tickets`
```sql
id (uuid)
event_id (uuid) -- foreign key (CRÍTICO para multi-evento)
code_id (uuid) -- foreign key
person_id (uuid)
promoter_id (uuid)
qr_token (uuid) -- único por ticket
dni (string)
document (string)
doc_type (string)
full_name (string)
email (string)
phone (string)
is_active (boolean)
deleted_at (timestamptz) -- soft delete
```

## Reglas de negocio

### ✅ Por usuario/documento
| Escenario | Permitido | Motivo |
|-----------|----------|--------|
| Mismo DNI en Evento A activo | ❌ NO | Sólo 1 ticket por evento activo |
| Mismo DNI en Evento A (cerrado) + Evento B (activo) | ✅ SÍ | Eventos diferentes |
| Mismo DNI re-registra Evento A (cerrado) | ✅ SÍ | Puede tener nuevo ticket evento cerrado |
| Usar QR de Evento A (cerrado) en puerta Evento B | ❌ NO | QR es específico por evento |

### ✅ Por evento
| Acción | Resultado |
|--------|-----------|
| Cierre evento | `is_active = false`, `closed_at = now()`, códigos inactivos |
| Búsqueda de tickets vigentes | Solo de eventos con `is_active = true` + `closed_at = null` |
| Búsqueda de códigos vigentes | Solo con `is_active = true` + evento activo |

### ✅ Por códigos
| Código | Vigencia | Restricción |
|--------|----------|-------------|
| General | Evento activo | Límite de hora si especificado |
| Invitado/Promotor | Evento activo | Sin límite de hora |
| Cortesía | Evento activo | Sin límite, use único |
| Mesa | Evento activo + Mesa disponible | Requiere combo |

## Flujo: Registro multi-evento

```
1. Usuario accede a landing con código (ej: "CUMPLE-03-2026")
   ↓
2. Sistema busca código activo
   - Valida código existe
   - Valida código.is_active = true
   - Obtiene evento_id del código
   ↓
3. Sistema busca evento
   - Valida evento.is_active = true
   - Valida evento.closed_at = null
   - Si falla → Error "Evento cerrado"
   ↓
4. Usuario ingresa su DNI
   ↓
5. Sistema busca último ticket vigente del usuario
   a) Con código → busca en evento del código
   b) Sin código → busca ticket MÁS RECIENTE de evento ACTIVO
   ↓
6. Decisión:
   - ✅ Ticket vigente encontrado → "VER MI QR"
   - ❌ Ticket NO vigente (evento cerrado) → "GENERAR QR"
   - ❌ Sin ticket → "GENERAR QR"
   ↓
7. Si GENERAR QR:
   - Validar evento activo (nuevamente)
   - Crear ticket nuevo
   - Incrementar uses del código
   - Generar QR
```

## Endpoints críticos

### Landing (público)
```
GET /api/events                    -- Lista eventos activos (por organizer)
GET /api/codes/info?code=...      -- Obtiene info código + evento
GET /api/persons?document=...     -- Busca persona + ÚLTIMO ticket VIGENTE
POST /api/tickets                  -- Crea ticket (valida evento activo)
POST /api/reservations             -- Reserva con mesas (multi-evento)
```

### Backoffice (admin)
```
POST /api/events/create            -- Crear evento
POST /api/events/update            -- Actualizar evento
POST /api/events/close             -- CIERRA evento + desactiva códigos
GET /api/events/list               -- Lista eventos (ordenado, con cierre info)
POST /api/codes/batches/generate   -- Genera códigos por evento
GET /api/codes/list?event_id=...  -- Códigos de evento
```

## Migraciones relevantes

- [2026-02-07-add-organizers-and-event-close.sql](../supabase/migrations/2026-02-07-add-organizers-and-event-close.sql)
  - Tabla `organizers`
  - Columnas `is_active`, `closed_at`, `closed_by`, `close_reason` en `events`
  - Índices para performance

- [2026-01-31-add-soft-delete.sql](../supabase/migrations/2026-01-31-add-soft-delete.sql)
  - Soft delete en todas las tablas críticas
  - Indices para `deleted_at`

## Performance

### Índices clave
```sql
-- Búsqueda de eventos activos por organizador
create index idx_events_organizer_active 
  on public.events(organizer_id, is_active, closed_at);

-- Búsqueda de códigos activos por evento
create index idx_codes_event_active 
  on public.codes(event_id, is_active);

-- Búsqueda de tickets por evento y documento
create index idx_tickets_event_document 
  on public.tickets(event_id, dni, deleted_at);

-- Búsqueda de tickets más recientes por documento
create index idx_tickets_document_recent 
  on public.tickets(dni, deleted_at, created_at desc);
```

### Querys optimization
- `applyNotDeleted` en TODAS las búsquedas
- Usar índices compuestos para filtros multi-columna
- Limit en búsquedas fallback (no full table scan)

## Seguridad

### Aislamiento por organizer
- [x] Cada staff solo ve eventos de su organizer
- [x] Códigos/tickets/reservas siempre filtrados por evento.organizer_id
- [x] Reportes agrupados por organizer

### Validaciones
- [x] DNI válido según formato
- [x] Documento único per evento (no duplicados)
- [x] Reingreso NO permitido (mismo ticket no puede usarse 2x)
- [x] QR único por ticket (no duplicidad)

### Rate limiting
- Landing `/api/persons` → 20 req/min por IP
- Landing `/api/tickets` → 10 req/min por IP (TODO)
- Admin `/api/codes/generate` → 5 req/min por staff

## Observabilidad

### Logs registrados
```typescript
category: "events"
action: "close_event"
status: "success"
meta: {
  event_id: string,
  closed_at: string (ISO),
  disabled_codes: number,
  reason: string | null
}
```

### Métricas para dashboards
- Eventos abiertos vs cerrados por organizer
- Códigos generados vs usados por evento
- Tickets emitidos por evento/día
- Tickets reutilizados (fallback matches)

## Casos de error

### Código inválido
```
Status: 404
Message: "Código inválido"
Causa: Código no existe o está deleted
```

### Código inactivo
```
Status: 400
Message: "Código inactivo"
Causa: Code.is_active = false
```

### Evento cerrado
```
Status: 400
Message: "Evento cerrado o inactivo"
Causa: Event.is_active = false OR Event.closed_at != null
```

### Documento inválido
```
Status: 400
Message: "Documento inválido"
Causa: DNI no pasa validación (formato)
```

### Ya tienes entrada (mismo evento activo)
```
Status: 200
Message: { success: true, existing: true, ticketId: "..." }
Causa: Usuario ya tiene ticket vigente del evento
```

## Próximos pasos

### Phase 1: Consolidar multi-evento (actual)
- [x] Tabla organizers
- [x] Cierre de evento con soft delete
- [x] Validaciones en endpoints
- [x] Tests de multi-evento

### Phase 2: Permisos por organizer
- [ ] RBAC: Staff solo accede su organizer
- [ ] Reportes segregados
- [ ] Billing por organizer

### Phase 3: Operación escalada
- [ ] Dashboard de eventos activos/cerrados
- [ ] Bulk close events (por campaña/mes)
- [ ] Archive de eventos (opcional, para reporting histórico)
