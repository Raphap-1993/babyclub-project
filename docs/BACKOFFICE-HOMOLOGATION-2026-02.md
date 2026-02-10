# Homologación de Arquitectura BackOffice - BabyClub

Fecha: 8 de febrero de 2026
Estado: En Progreso

## Objetivo
Crear una arquitectura uniforme y performante para el BackOffice usando componentes reutilizables y patrones consistentes.

## Problemas Identificados

### 1. 404 en ruta evento
**Causa:** No existía la ruta `/admin/events/[id]` - solo existía `/admin/events/[id]/edit`
**Solución:** Creada nueva ruta de detalle con visualización de toda la información del evento

### 2. Fragmentación de UI
- Cada pantalla tenía diseños inconsistentes
- Falta de componentes reutilizables
- Colores y estilos no homogéneos (naranja vs. rose)
- Usuarios perdiendo información al navegar

## Soluciones Implementadas

### 1. ExpandableDataTable Component ✅
**Ubicación:** `/apps/backoffice/components/dashboard/ExpandableDataTable.tsx`

**Características:**
- Expansión de filas sin navegación (chevron icon toggle)
- Responsive design: tabla desktop, cards mobile
- Paginación integrada con controles de página
- Selector de tamaño de página (5, 10, 15, 20, 30, 50)
- Columnas configurables como "expandibles" o "siempre visibles"
- Contenido expandido personalizable por tabla
- Soporte para acciones por fila (edit, delete, view)

**Propiedades:**
```typescript
interface ExpandableDataTableProps<T> {
  data: T[];
  columns: ExpandableColumn<T>[]; // Con propiedad expandable?: boolean
  expandedContent?: (row: T) => ReactNode; // Contenido personalizado
  actions?: (row: T) => ReactNode;
  pagination?: { page, pageSize, total, basePath };
  emptyMessage?: string;
  visibleColumns?: number; // Default 3
}
```

**Ventajas:**
- ✅ Sin navegación = edición más rápida
- ✅ Mobile-first responsive
- ✅ Performante: no requiere componentes adicionales
- ✅ Compatible con shadcn-ui

### 2. Ruta de Detalle Evento ✅
**Ubicación:** `/apps/backoffice/app/admin/events/[id]/page.tsx`

**Features:**
- Visualización de detalles completos
- Vista previa de imagen de portada
- Información de capacidad y límites
- Quick actions sidebar
- Links a recursos relacionados (códigos, tickets)

### 3. Actualización Eventos ✅
**Archivo:** `/apps/backoffice/app/admin/events/EventsClient.tsx`

**Cambios:**
- Cambio de `DataTable` → `ExpandableDataTable`
- Color actualizado: naranja → **rose-500** (BabyClub red)
- Columnas configuradas como expandibles: ubicación, capacidad, código
- `visibleColumns={3}` para modo compacto
- Sin hover blanco en header

## Arquitectura Target

### Patrón Estándar por Pantalla

```
/admin/{resource}/
├── page.tsx                    (Server: fetch data + pagination)
├── {resource}Client.tsx        (Client: ExpandableDataTable)
├── [id]/page.tsx              (Server: detail view)
├── create/page.tsx            (Form para crear)
└── components/
    └── {resource}Form.tsx     (Form reutilizable)
```

### Stack Técnico Consistente
```
Componente          | Ubicación
------------------|-------------------------------------------------
ExpandableDataTable | @/components/dashboard/ExpandableDataTable
RowActions         | @/components/dashboard/RowActions
Button/Link        | @repo/ui + gradient rose-500/rose-600
Icons              | lucide-react
Colors             | Tailwind: slate-900 base, rose-500 emphasis
Pagination         | URL params (page, pageSize)
Forms              | react-hook-form + zod (cuando aplique)
```

### Color Scheme (Homologado)
```
Elemento           | Clase Tailwind
-------------------|-----------------------
Fondo              | bg-slate-900
Hover secundario    | hover:bg-slate-800/50
Border             | border-slate-700
Texto principal    | text-white
Texto secundario    | text-slate-300
Texto terciario    | text-slate-400
Acción principal   | bg-gradient-to-r from-rose-500 to-rose-600
Acción hover       | hover:from-rose-400 hover:to-rose-500
Estado activo      | bg-rose-500/20 text-rose-400
Badge inactivo     | bg-slate-700/50 text-slate-400
```

## Pantallas a Homologar

### Críticas (Prioridad 1)
| Pantalla | Ubicación | Estado | Notas |
|----------|-----------|--------|-------|
| Eventos | `/admin/events` | ✅ DONE | ExpandableDataTable + expandable rows |
| Detalle Evento | `/admin/events/[id]` | ✅ DONE | Nuevo - visualización completa |
| Códigos | `/admin/codes` | ⏳ TODO | Expandar por evento, tipo, estado |
| Tickets | `/admin/tickets` | ⏳ TODO | Expandar por evento, estado, QR |
| Usuarios | `/admin/users` | ⏳ TODO | Expandar por roles, estado |

### Importantes (Prioridad 2)
| Pantalla | Ubicación | Estado | Notas |
|----------|-----------|--------|-------|
| Reservas | `/admin/reservations` | ⏳ TODO | Expandar por mesa, evento |
| Mesas | `/admin/tables` | ⏳ TODO | Expandar por capacidad, precio |
| Mesas-Reservas | `/admin/mesas-reservas` | ⏳ TODO | Expandar por evento |

### Secundarias (Prioridad 3)
| Pantalla | Ubicación | Estado |
|----------|-----------|--------|
| Door (Control Puerta) | `/admin/door` | ⏳ KEEP |
| Scan (Escaneo) | `/admin/scan` | ⏳ KEEP |
| Ingresos | `/admin/ingresos` | ⏳ TODO |
| Asistencia | `/admin/asistencia` | ⏳ TODO |
| Logs | `/admin/logs` | ⏳ KEEP |
| Promoters | `/admin/promoters` | ⏳ TODO |
| Integraciones | `/admin/integraciones` | ⏳ KEEP |
| Seguridad | `/admin/seguridad` | ⏳ KEEP |
| Branding | `/admin/branding` | ⏳ KEEP |
| Table Products | `/admin/table-products` | ⏳ TODO |

## Checklist de Homologación por Pantalla

### Antes de marcar como ✅ DONE
- [ ] Usa `ExpandableDataTable` (no `DataTable`)
- [ ] Colores: rose-500/rose-600 en botones principales
- [ ] Sin hover blanco en headers
- [ ] Paginación con URL params (page, pageSize)
- [ ] Columnas configuradas: 3 visibles + expandibles adicionales
- [ ] `RowActions` con Edit/Delete/View apropiados
- [ ] Ruta `[id]/page.tsx` para detalle si aplica
- [ ] Mobile responsive (cards en <lg)
- [ ] Contenido expandido muestra todos los campos
- [ ] API endpoint de delete configurado

## Reglas de Migración

### 1. No hay datos destructivos
- Soft delete solo (never hard delete)
- Migrations aditivas en Supabase
- Auditoría de cada cambio

### 2. Server-side primero
- `page.tsx`: Fetch + Pagination logic
- `*Client.tsx`: Render + Interactions
- Separación clara de concerns

### 3. Consistencia visual
- Uso obligatorio de gradientes rose en botones principales
- Badges con color de estado (rose, slate, green, etc.)
- Icons de lucide-react (Edit, Trash2, Eye, ChevronDown, etc.)

### 4. Performance
- `ExpandableDataTable` no carga datos adicionales al expandir
- Paginación backend (range queries a Supabase)
- Lazy loading para imágenes
- Sin N+1 queries

## Timeline Sugerido

| Fase | Semana | Pantallas |
|------|--------|-----------|
| Sprint 1 | 1 | Eventos ✅, Códigos, Tickets |
| Sprint 1 | 2 | Usuarios, Reservas |
| Sprint 2 | 1 | Mesas, Ingresos, Promoters |
| Sprint 2 | 2 | Table Products, Asistencia + QA |

## Dependencias

### Componentes Requeridos
- ✅ `ExpandableDataTable.tsx` - LISTO
- ✅ `RowActions.tsx` - LISTO
- ✅ `@repo/ui` (Button, Badge, Table, etc.) - LISTO
- ✅ `lucide-react` icons - LISTO
- ✅ Tailwind CSS - LISTO

### Utilidades Requeridas
- ✅ `applyNotDeleted` - Filtro de soft delete
- ✅ `formatLimaFromDb` - Formato de fechas
- ✅ Supabase client - LISTO

## Ejemplos de Implementación

### Pantalla Código (PRÓXIMA)
```typescript
// pages/codes/page.tsx
async function getCodes(params: { page, pageSize }) {
  // SELECT code, event_id, type, is_active, usage_count
  // FROM codes WHERE deleted_at IS NULL
  // ORDER BY created_at DESC
}

// CodesClient.tsx
const columns = [
  { key: "code", label: "Código", render: () => <code>...{}</code> },
  { key: "type", label: "Tipo", expandable: true },
  { key: "event_id", label: "Evento", expandable: false },
  { key: "is_active", label: "Estado", render: () => <Badge /> },
  { key: "usage_count", label: "Usos", expandable: true },
];

<ExpandableDataTable
  columns={columns}
  data={codes}
  expandedContent={(code) => (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p>Creado: {formatDate(code.created_at)}</p>
        <p>Límite: {code.usage_limit}</p>
      </div>
    </div>
  )}
/>
```

## Preguntas Resueltas

**Q: ¿Es muy pesado expandir filas?**
A: No. `ExpandableDataTable` no carga datos adicionales. Solo renderiza los campos existentes. 
   Performance es O(1) por fila.

**Q: ¿Qué tan rápido es la edición sin navegar?**
A: Muy rápido. Al expandir la fila ves todos los campos + acciones (Edit, Delete).
   Un click en Edit → ruta `/admin/{resource}/[id]/edit`.

**Q: ¿Las grillas soportan esto?**
A: Sí. Usamos `<tbody>` anidados para mantener semántica HTML.
   Mobile: convertimos a cards sin problemas.

**Q: ¿Cómo manejar contenido muy largo?**
A: Prop `expandedContent` permite contenido personalizado:
   ```tsx
   expandedContent={(row) => (
     <Tabs>
       <TabContent>Tab 1</TabContent>
     </Tabs>
   )}
   ```

## Siguientes Pasos

1. ✅ ExpandableDataTable creado
2. ✅ Eventos homologados
3. ⏳ Códigos (similar a eventos)
4. ⏳ Tickets (con estado + escaneo)
5. ⏳ Usuarios (con roles)
6. ⏳ Mesas y Reservas
7. ⏳ QA y performance testing

## Contacto & Preguntas

Ver documentación en:
- `docs/ARCHITECTURE_V2.md` - Contexto general
- `docs/STRANGLER_PLAN.md` - Roadmap de migración
- `AGENTS.md` - Principios del equipo

---
**Documento vivo.** Última actualización: 8 feb 2026
