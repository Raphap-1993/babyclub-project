# Migración: Mesas por Organizador (2026-02-08)

## Estado: EN PROCESO

## Problema resuelto
Las mesas estaban asociadas a eventos (`tables.event_id`), lo que obligaba a crear las mismas 10 mesas para cada evento. Con 12 eventos/año, esto significa 120 duplicados innecesarios.

## Solución implementada
Las mesas ahora pertenecen al organizador (venue), no a eventos individuales:
- Una mesa se crea **una sola vez** por el organizador
- La disponibilidad por evento se maneja con tabla de unión `table_availability`
- Reducción masiva de duplicación de datos

## Cambios en base de datos

### Migración creada
- Archivo: `supabase/migrations/2026-02-08-tables-por-organizador.sql`
- Estado: **NO EJECUTADA** (usuario canceló reset de BD)

### Estructura nueva
```sql
-- Tabla de disponibilidad (junction table)
CREATE TABLE IF NOT EXISTS table_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT true,
  custom_price NUMERIC(10,2),
  custom_min_consumption NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(table_id, event_id)
);

-- Las mesas ahora SOLO tienen organizer_id (sin event_id)
ALTER TABLE tables DROP COLUMN IF EXISTS event_id;
```

### Migración de datos
- Datos existentes migrados a `table_availability`
- Trigger automático: cuando se crea un nuevo evento, se auto-generan registros de disponibilidad para todas las mesas del organizador
- Soft delete consistente

## Cambios en código (en proceso)

### Archivos actualizados
1. ✅ `/apps/backoffice/app/admin/tables/page.tsx`
   - Query cambiado: obtiene mesas por `organizer_id` (sin filtro de `event_id`)
   - Reservas se filtran por evento seleccionado (opcional)
   
2. 🔄 `/apps/backoffice/app/admin/tables/create/page.tsx`
   - **Pendiente**: cambiar de `getActiveEvent()` a `getOrganizer()`
   
3. 🔄 `/apps/backoffice/app/admin/tables/components/TableForm.tsx`
   - **Pendiente**: remover `event_id`, usar `organizer_id`
   
4. 🔄 `/apps/backoffice/app/admin/tables/[id]/edit/page.tsx`
   - **Pendiente**: remover referencia a `events(name)`

### APIs afectadas (pendiente)
- `POST /api/tables` - cambiar payload de `event_id` a `organizer_id`
- `PUT /api/tables/[id]` - idem
- `GET /api/tables` - ajustar query para usar organizer

### Pantallas nuevas necesarias
1. **Gestión de mesas del organizador** (`/admin/organizers/[id]/tables`)
   - CRUD completo de mesas
   - Sin relación con eventos
   
2. **Configuración de disponibilidad por evento** (`/admin/events/[id]/tables`)
   - Seleccionar qué mesas están disponibles
   - Precios/consumo personalizados por evento

## Plan de ejecución seguro

### Fase 1: Aplicar migración (PENDIENTE)
```bash
# Opción A: Reset completo (desarrollo local)
npx supabase db reset --db-url "$DATABASE_URL"

# Opción B: Aplicar migración directa (producción)
npx supabase migration up --db-url "$DATABASE_URL"
```

### Fase 2: Actualizar código (EN PROCESO)
1. ✅ Queries de lectura (page.tsx)
2. ⏳ Formularios de creación/edición
3. ⏳ APIs backend
4. ⏳ Validaciones

### Fase 3: Testing
- [ ] Crear mesa desde backoffice
- [ ] Editar mesa existente
- [ ] Verificar disponibilidad automática en eventos
- [ ] Reservar mesa en evento específico
- [ ] Verificar soft delete

### Fase 4: Deploy
- [ ] Aplicar migración en staging
- [ ] Validar funcionalidad
- [ ] Aplicar en producción
- [ ] Monitoreo post-deploy

## Riesgos

### Alto
- ⚠️ **Ruptura de contratos API**: código actual espera `event_id` en tabla `tables`
- ⚠️ **Reservas activas**: migración debe preservar relación tabla-evento

### Medio
- ⚠️ **UX**: usuarios acostumbrados a crear mesas por evento
- ⚠️ **Rollback**: requiere revertir migración Y código

### Bajo
- Performance: junction table bien indexada

## Rollback plan
1. Revertir código (git)
2. Revertir migración:
   ```sql
   ALTER TABLE tables ADD COLUMN event_id UUID REFERENCES events(id);
   UPDATE tables SET event_id = (SELECT event_id FROM table_availability WHERE table_id = tables.id LIMIT 1);
   DROP TABLE table_availability;
   ```

## Próximos pasos inmediatos
1. ✅ Decidir: aplicar migración ahora o esperar
2. ⏳ Terminar actualización de formularios
3. ⏳ Actualizar APIs
4. ⏳ Crear pantallas de gestión
5. ⏳ Testing completo

## Notas
- Coordinación requerida entre BD y código
- No se puede aplicar migración sin actualizar APIs
- Usuario canceló reset de BD - pendiente decisión
