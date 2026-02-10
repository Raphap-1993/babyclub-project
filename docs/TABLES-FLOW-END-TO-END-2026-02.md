# Flujo End-to-End: Gestión de Mesas por Organizador

**Fecha:** 2026-02-08  
**Arquitectura:** V2 - Mesas por Organizador con Disponibilidad por Evento

---

## 🎯 Contexto

Cada organizador (BabyClub, Coorimetria, etc.) tiene su propio inventario de mesas y croquis independiente. Las mesas se crean una vez a nivel organizador y se activan/desactivan por evento según disponibilidad.

---

## 📊 Modelo de Datos

### Tablas Principales

```sql
-- Organizadores (dueños de las mesas)
organizers
  - id (PK)
  - name
  - slug
  - logo_url
  - layout_url (imagen del croquis)
  - is_active
  - deleted_at (soft delete)

-- Inventario de mesas (por organizador)
tables
  - id (PK)
  - organizer_id (FK -> organizers) ⭐ OWNER
  - name (ej: "Mesa VIP 1", "Box A")
  - ticket_count (capacidad)
  - price (precio base)
  - min_consumption (consumo mínimo base)
  - layout_x, layout_y (posición en croquis)
  - is_active
  - deleted_at (soft delete)

-- Disponibilidad por evento (junction table)
table_availability
  - id (PK)
  - table_id (FK -> tables)
  - event_id (FK -> events)
  - is_available (activa/desactiva para este evento)
  - custom_price (precio específico del evento, nullable)
  - custom_min_consumption (consumo mínimo específico, nullable)
  - notes (notas específicas del evento)
  - created_at

-- Eventos
events
  - id (PK)
  - organizer_id (FK -> organizers)
  - name
  - starts_at
  - is_active
  - is_closed
  - deleted_at (soft delete)
```

---

## 🔄 Flujo Completo End-to-End

### FASE 1: Configuración del Organizador

#### 1.1 Gestionar Inventario de Mesas

**Punto de entrada:**  
`/admin/organizers` → Card del organizador → Botón "🪑 Gestionar Mesas"

**Ruta:**  
`/admin/organizers/[organizerId]/tables`

**Componentes:**
- `apps/backoffice/app/admin/organizers/[id]/tables/page.tsx` (server)
- `apps/backoffice/app/admin/organizers/[id]/tables/OrganizerTablesClient.tsx` (client)

**API:**  
`/api/organizers/[id]/tables`

**Funcionalidades:**
1. **Crear Mesa Nueva**
   - Formulario inline (columna izquierda)
   - Campos:
     * Nombre (obligatorio, ej: "Mesa VIP 1")
     * Capacidad (ticket_count, obligatorio)
     * Precio base (opcional)
     * Consumo mínimo base (opcional)
   - Al crear:
     * Se inserta en `tables` con `organizer_id`
     * Se auto-vincula a eventos activos del organizador vía trigger `create_availability_for_new_table`

2. **Editar Mesa**
   - Inline edit en la lista (columna derecha)
   - Actualiza datos base de la mesa

3. **Eliminar Mesa**
   - Soft delete (`deleted_at`)
   - Se marca como inactiva
   - No se pueden eliminar mesas con reservas activas

**Reglas de Negocio:**
- ✅ Nombre único dentro del organizador
- ✅ Capacidad > 0
- ✅ Auto-activación en eventos activos del organizador
- ✅ Soft delete con validación de integridad

---

#### 1.2 Diseñar Croquis (Layout)

**Punto de entrada:**  
`/admin/organizers` → Card del organizador → Botón "📐 Diseñar Croquis"

**Ruta:**  
`/admin/organizers/[organizerId]/layout`

**Componentes:**
- `apps/backoffice/app/admin/organizers/[id]/layout/page.tsx` (server)
- `apps/backoffice/app/admin/organizers/[id]/layout/OrganizerLayoutClient.tsx` (client)

**API:**  
- `POST /api/uploads/layout` (subir imagen de fondo)
- `PUT /api/organizers/[id]/layout` (guardar posiciones)

**Funcionalidades:**
1. **Subir Imagen de Fondo**
   - Upload de imagen del local/venue
   - Se guarda en `organizers.layout_url`

2. **Posicionar Mesas**
   - Drag & drop de mesas al canvas
   - Coordenadas se guardan en `tables.layout_x` y `tables.layout_y`
   - Grid opcional para alineación

3. **Exportar/Importar**
   - Exportar layout a JSON
   - Importar configuración previa

**Reglas de Negocio:**
- ✅ Layout es específico del organizador
- ✅ Posiciones se guardan a nivel mesa (reutilizable en eventos)
- ✅ Imagen de fondo opcional

---

### FASE 2: Configuración por Evento

#### 2.1 Activar/Configurar Mesas en Evento Específico

**Punto de entrada:**  
`/admin/events/[eventId]` → Botón "⚙️ Configurar Mesas"

**Ruta:**  
`/admin/events/[eventId]/tables`

**Componentes:**
- `apps/backoffice/app/admin/events/[id]/tables/page.tsx` (server)
- `apps/backoffice/app/admin/events/[id]/tables/EventTablesClient.tsx` (client)

**API:**  
`/api/events/[eventId]/tables`

**Funcionalidades:**
1. **Ver Mesas del Organizador**
   - Lista completa del inventario del organizador
   - Indica cuáles están activas para este evento

2. **Activar/Desactivar**
   - Toggle `table_availability.is_available`
   - Control fino por evento

3. **Precio Personalizado**
   - Sobrescribir precio base: `table_availability.custom_price`
   - Si es null, usa `tables.price`

4. **Consumo Mínimo Personalizado**
   - Sobrescribir consumo base: `table_availability.custom_min_consumption`
   - Si es null, usa `tables.min_consumption`

5. **Notas por Evento**
   - `table_availability.notes`
   - Ejemplo: "Reservada para sponsor X"

**Reglas de Negocio:**
- ✅ Solo mesas del mismo organizador del evento
- ✅ Precios custom opcionales (fallback a precio base)
- ✅ Disponibilidad independiente por evento

---

### FASE 3: Operación en Venta (Landing/Backoffice)

#### 3.1 Venta desde Landing (Cliente Final)

**Ruta:**  
`apps/landing/app/[eventSlug]/reservar`

**Proceso:**
1. Usuario selecciona evento
2. Ve mesas disponibles (`is_available = true` en `table_availability`)
3. Selecciona mesa
4. Sistema verifica:
   - Mesa activa para el evento
   - No reservada previamente
   - Capacidad disponible
5. Crea reserva en `reservations`
6. Procesa pago con Culqi
7. Genera QR único

**Consulta SQL Clave:**
```sql
SELECT 
  t.id,
  t.name,
  t.ticket_count,
  COALESCE(ta.custom_price, t.price) as final_price,
  COALESCE(ta.custom_min_consumption, t.min_consumption) as final_min_consumption
FROM tables t
JOIN table_availability ta ON ta.table_id = t.id
WHERE ta.event_id = $1
  AND ta.is_available = true
  AND t.is_active = true
  AND t.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM reservations r 
    WHERE r.table_id = t.id 
      AND r.event_id = $1 
      AND r.status != 'cancelled'
  );
```

---

#### 3.2 Reserva desde Backoffice (Admin/Cajero)

**Ruta:**  
`/admin/reservations` → Botón "Nueva Reserva"

**Proceso:**
1. Admin selecciona evento
2. Sistema carga mesas disponibles del evento
3. Admin selecciona mesa y cliente
4. Genera reserva manual
5. Puede marcar como pagado o pendiente

**Validaciones:**
- ✅ Mesa activa en el evento
- ✅ Mesa no reservada
- ✅ Evento no cerrado

---

### FASE 4: Operación en Puerta (Escaneo)

**Ruta:**  
`/admin/scan`

**Proceso:**
1. Personal de puerta escanea QR
2. Sistema valida:
   - QR válido y único
   - Reserva pagada
   - Evento correcto
   - No usado previamente
3. Marca entrada en BD
4. Muestra datos de mesa y cliente

**SLA Objetivo:**  
≤ 2 segundos por validación

---

## 🗂️ Archivos por Módulo

### Módulo: Organizadores

| Archivo | Tipo | Propósito |
|---------|------|-----------|
| `/admin/organizers/page.tsx` | Server | Dashboard de organizadores |
| `/admin/organizers/[id]/tables/page.tsx` | Server | Gestión de inventario de mesas |
| `/admin/organizers/[id]/tables/OrganizerTablesClient.tsx` | Client | UI de creación/edición de mesas |
| `/admin/organizers/[id]/layout/page.tsx` | Server | Diseñador de croquis |
| `/admin/organizers/[id]/layout/OrganizerLayoutClient.tsx` | Client | Canvas drag & drop |
| `/api/organizers/[id]/tables/route.ts` | API | CRUD de mesas del organizador |
| `/api/organizers/[id]/layout/route.ts` | API | Guardar posiciones del croquis |

### Módulo: Eventos

| Archivo | Tipo | Propósito |
|---------|------|-----------|
| `/admin/events/[id]/tables/page.tsx` | Server | Configuración de disponibilidad |
| `/admin/events/[id]/tables/EventTablesClient.tsx` | Client | UI de activación/precios custom |
| `/api/events/[id]/tables/route.ts` | API | Gestión de `table_availability` |

### Módulo: Reservas

| Archivo | Tipo | Propósito |
|---------|------|-----------|
| `/admin/reservations/page.tsx` | Server | Lista de reservas |
| `/admin/reservations/[id]/page.tsx` | Server | Detalle de reserva |
| `/api/reservations/route.ts` | API | CRUD de reservas |

---

## 🧹 Archivos OBSOLETOS (Candidatos a Limpiar)

### ❌ Rutas Legacy de Mesas Globales

**ANTES:** Mesas estaban ligadas a eventos directamente  
**AHORA:** Mesas son de organizadores, eventos usan `table_availability`

#### Archivos a Deprecar:

1. **`/admin/tables/page.tsx`** (Vista global antigua)
   - ⚠️ **Acción:** Convertir en redirect a `/admin/organizers` o eliminar
   - **Razón:** Ahora se gestionan desde cada organizador

2. **`/admin/tables/create/page.tsx`** (Creación global de mesas)
   - ❌ **Acción:** ELIMINAR
   - **Razón:** Se crea desde `/admin/organizers/[id]/tables`

3. **`/admin/tables/[id]/edit/page.tsx`** (Edición standalone)
   - ❌ **Acción:** ELIMINAR
   - **Razón:** Se edita inline en organizer tables view

4. **`/admin/tables/layout/page.tsx`** (Layout global antiguo)
   - ❌ **Acción:** ELIMINAR
   - **Razón:** Cada organizador tiene su propio layout en `/admin/organizers/[id]/layout`

5. **`/admin/tables/TablesClient.tsx`**
   - ⚠️ **Acción:** Revisar y simplificar o eliminar
   - **Razón:** Podría ser útil como componente reutilizable, pero actualmente ambiguo

6. **`/admin/tables/components/TableForm.tsx`**
   - ⚠️ **Acción:** Eliminar si solo se usaba en páginas obsoletas
   - **Razón:** Formulario inline en `OrganizerTablesClient` lo reemplaza

---

## 🔐 Validaciones y Seguridad

### A Nivel Base de Datos

```sql
-- Constraint: Mesa pertenece a organizador
ALTER TABLE tables 
ADD CONSTRAINT fk_tables_organizer 
FOREIGN KEY (organizer_id) REFERENCES organizers(id);

-- Constraint: Disponibilidad solo de mesas del organizador del evento
ALTER TABLE table_availability
ADD CONSTRAINT check_same_organizer
CHECK (
  EXISTS (
    SELECT 1 FROM tables t
    JOIN events e ON e.id = table_availability.event_id
    WHERE t.id = table_availability.table_id
      AND t.organizer_id = e.organizer_id
  )
);

-- Unique constraint: Una mesa solo puede tener una entrada de disponibilidad por evento
ALTER TABLE table_availability
ADD CONSTRAINT unique_table_event
UNIQUE (table_id, event_id);
```

### A Nivel API

- ✅ Verificar `organizer_id` coincide entre mesa y evento
- ✅ Validar permisos RBAC (admin/cajero)
- ✅ Soft delete obligatorio
- ✅ Idempotencia en creación de reservas

---

## 📈 Métricas de Éxito

| Métrica | Objetivo |
|---------|----------|
| Tiempo de creación de mesa | < 10s |
| Tiempo de diseño de croquis | < 5 min |
| Duplicados eliminados | -90% |
| Tiempo de activación por evento | < 30s |
| SLA de escaneo en puerta | ≤ 2s |

---

## 🚀 Próximos Pasos

1. ✅ **Eliminar rutas obsoletas** (ver sección "Archivos OBSOLETOS")
2. ⏳ **Agregar validación de constraints** en BD
3. ⏳ **Migrar datos legacy** (si existen mesas con `event_id` sin `organizer_id`)
4. ⏳ **Tests E2E** del flujo completo
5. ⏳ **Documentación de API** (Swagger/OpenAPI)

---

## 📝 Notas Técnicas

- **Trigger automático:** Al crear mesa, se auto-vincula a eventos activos
- **Precio dinámico:** `COALESCE(custom_price, base_price)` en queries
- **Soft delete:** Todas las tablas usan `deleted_at`
- **Audit trail:** Considerar agregar `updated_by` y `updated_at` en el futuro

---

**Autor:** Sistema BabyClub  
**Última actualización:** 2026-02-08  
**Versión arquitectura:** V2 - Organizer-Centric Tables
