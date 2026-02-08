# Referencia Rápida: Cómo Funcionan las Mesas y Layouts Hoy

**Uso**: Leer esto para entender el flujo actual antes de discutir cambios.

---

## 🎯 En 3 Puntos

1. **Croquis = Global**: Un solo croquis (`layout_settings.layout_url`) para toda la plataforma
2. **Mesas = Evento**: Cada mesa se asigna a 1 evento (`tables.event_id`)
3. **Posiciones = Porcentaje**: Las mesas se posicionan en el croquis como X,Y% del ancho/alto

---

## 📊 Flujo de Usar Mesas

### Creador de Evento (Admin)
```
1. Crea evento en /admin/events/create
   ↓
2. Va a /admin/tables/layout
   ↓
3. Ve croquis único + lista de mesas del evento
   ↓
4. Arrastra mesas sobre el croquis (pos_x, pos_y)
   ↓
5. Guarda → POST /api/tables/update por cada mesa
```

### Cliente Final (Landing)
```
1. Ingresa código del evento
   ↓
2. Elige reservar mesa (si hay)
   ↓
3. Ve mesas disponibles con su posición en croquis
   ↓
4. Completa datos y paga
```

### En Puerta (Scan)
```
1. Admin inicia escaneo para evento X
   ↓
2. Escanea QR del ticket
   ↓
3. Valida: código activo, no reingreso, etc.
   ↓
4. ✅ Ticket marcado como usado
   (Nota: no necesita ver croquis, solo valida QR)
```

---

## 🗄️ Estructura de Datos

### layout_settings (global, 1 solo registro)
```sql
id = 1
layout_url = "https://cdn.babyclub.com/salones/default.jpg"
updated_at = 2025-02-08
is_active = true
```

**Nota**: El croquis es una imagen (PNG/JPG). El layout es la imagen en sí, no metadata.

### tables (mesas por evento)
```sql
id               | event_id | name    | pos_x | pos_y | pos_w | pos_h | ...
uuid             | uuid ref | text    | float | float | float | float |
"mesa-1"         | "evt-001"| "M1"    | 10.5  | 20.3  | 5.2   | 5.2   |
"mesa-2"         | "evt-001"| "M2"    | 20.1  | 20.3  | 5.2   | 5.2   |
"mesa-3"         | "evt-002"| "M1"    | 15.0  | 30.0  | 6.0   | 6.0   | ← Misma mesa, otra posición
```

**Ejemplo Real**:
- `pos_x = 10.5` → mesa empieza en 10.5% desde la izquierda
- `pos_y = 20.3` → mesa empieza en 20.3% desde la arriba
- `pos_w = 5.2`  → mesa ocupa 5.2% del ancho del croquis
- `pos_h = 5.2`  → mesa ocupa 5.2% del alto del croquis

### events
```sql
id             | name              | organizer_id | starts_at | ...
uuid           | text              | uuid ref     | timestamp |
"evt-001"      | "Cumple Juan"     | "org-baby"   | 2025-03-15 |
"evt-002"      | "Cumple María"    | "org-baby"   | 2025-03-22 |
```

---

## 🔗 Rutas API Clave

### Cargar Layout + Mesas (LayoutEditor)
```
GET /api/layout
Response: { layout_url: "https://..." }

GET /api/tables?event_id=evt-001
Response: {
  tables: [
    { id: "mesa-1", name: "M1", event_id: "evt-001", pos_x: 10.5, ... },
    { id: "mesa-2", name: "M2", event_id: "evt-001", pos_x: 20.1, ... }
  ]
}
```

### Subir Croquis
```
POST /api/uploads/layout
Body: FormData con archivo
Response: { file_url: "https://..." }
↓
Internamente actualiza layout_settings.layout_url
```

### Guardar Posición de Mesa
```
POST /api/tables/update
Body: {
  id: "mesa-1",
  name: "M1",
  pos_x: 15.0,
  pos_y: 22.5,
  pos_w: 5.2,
  pos_h: 5.2,
  ...
}
Response: { success: true }
```

### Crear Nueva Mesa
```
POST /api/tables/create
Body: {
  name: "M5",
  event_id: "evt-001",
  ticket_count: 6,
  price: null
}
Response: { id: "mesa-5", ... }
```

---

## 🎨 Cómo Funciona el Drag & Drop (Técnico)

### En LayoutEditor.tsx
```typescript
const onDrop = (event: React.DragEvent, id: string) => {
  // Obtener bounds del contenedor
  const rect = containerRef.current.getBoundingClientRect();
  
  // Convertir pixel a porcentaje (0-100)
  const rawX = ((event.clientX - rect.left) / rect.width) * 100;
  const rawY = ((event.clientY - rect.top) / rect.height) * 100;
  
  // Snap fino a 0.5% para precisión visual
  const snap = 0.5;
  const x = Math.round(rawX / snap) * snap;
  const y = Math.round(rawY / snap) * snap;
  
  // Guardar posición clamped (0-100)
  updateTablePos(id, {
    pos_x: Math.max(0, Math.min(100, x)),
    pos_y: Math.max(0, Math.min(100, y))
  });
};
```

**Por qué porcentaje y no píxeles?**
- Los croquis pueden tener diferentes tamaños
- Porcentaje escala automáticamente (responsive)
- Se puede cambiar croquis sin recalcular posiciones

---

## 🛡️ Reglas Actuales

### En Croquis
- ✅ Un solo croquis global
- ✅ Todos los eventos lo usan
- ✅ Los eventos no pueden tener croquis personalizados

### En Mesas
- ✅ Una mesa se asigna a 1 evento (event_id)
- ✅ Posición es válida solo en ese evento
- ✅ No se puede "copiar" una mesa a otro evento (crear nueva)

### En Reservas
- ✅ Solo se reservan mesas del evento actual
- ✅ No se puede ver mesas de otro evento
- ✅ El cliente ve el croquis único (no especifico del evento)

---

## ⚠️ Problemas / Casos Borde

### Problema 1: Mismo Croquis para Todos
```
Evento A: cumpleaños, 30 personas, salón A
Evento B: bautizo, 60 personas, salón B

Ambos usan el MISMO croquis
↓
¿Qué pasa si croquis no tiene espacio para las mesas de Evento B?
→ Algunos mesas se salen del croquis (pos_x > 100 o pos_y > 100)
→ El admin debe ajustar manualmente por evento
```

### Problema 2: Multiorganizador
```
Org A y Org B hacen alianza en Evento C

¿Cuál es el croquis? ¿Salón compartido?
¿Las mesas se duplican o se comparten?

Hoy no hay solución: requiere coordinar manual
```

### Problema 3: Croquis Roto
```
Admin sube un croquis a 4K (10MB)
→ Cargar LayoutEditor es lento
→ No hay versionado, si lo borra, se perdió

Hoy: sin control de versiones en croquis
```

---

## 🧪 Cómo Probar Esto Localmente

### 1. Setup
```bash
cd /Users/rapha/Projects/babyclub-monorepo
pnpm install
pnpm dev
```

### 2. Acceder a LayoutEditor
```
URL: http://localhost:3000/admin/tables/layout
Auth: necesitas user admin
```

### 3. Crear una Mesa Rápidamente
```bash
curl -X POST http://localhost:3000/api/tables/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name": "TestMesa",
    "event_id": "evt-001",
    "ticket_count": 4
  }'
```

### 4. Ver Posiciones Guardadas
```
Inspeccionar con DevTools (Console):
fetch('/api/tables?event_id=evt-001')
  .then(r => r.json())
  .then(d => console.log(d.tables))
```

---

## 🧠 Conceptos Clave a Retener

| Término | Significa |
|---------|-----------|
| `layout_settings` | Tabla con 1 registro: el croquis global |
| `layout_url` | URL de la imagen del croquis |
| `pos_x, pos_y` | Posición en % (0-100) desde esquina superior izquierda |
| `pos_w, pos_h` | Dimensiones de la mesa en % |
| `event_id` (en tables) | Qué evento usa esta mesa |
| Drag & Drop | UI para mover mesas; por debajo actualiza pos_x/y |
| RLS (Row-Level Security) | Supabase filtra datos por usuario/rol |

---

## 🎬 Flujo Visual

```
┌─────────────────────────────────────────────────────┐
│ LAYOUT EDITOR (/admin/tables/layout)                │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [Selector de Evento]  ← Filtro por event_id       │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │                CROQUIS (layout_url)          │  │
│  │  global/static para todos los eventos       │  │
│  │                                              │  │
│  │  ╔═════╗  ╔═════╗                           │  │
│  │  ║ M1  ║  ║ M2  ║   ← Draggable            │  │
│  │  ║pos_x║  ║pos_x║                           │  │
│  │  ║pos_y║  ║pos_y║                           │  │
│  │  ╚═════╝  ╚═════╝                           │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  [M1] [M2] [M3] ← Lista de mesas del evento        │
│                                                     │
│  [Guardar] ← POST /api/tables/update por mesa      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📝 Cosas que NO Cambian

(Si implementamos multi-evento con Opción A):

- ✅ API de reservas (ya filtra por evento)
- ✅ API de tickets (ya filtra por evento)
- ✅ API de scan/puerta (ya filtra por evento)
- ✅ Estructura de `tables` (ya tiene event_id)
- ✅ Drag & Drop (sigue siendo igual)

Lo único que **SÍ cambia**:
- 🔄 `GET /api/layout` → filtrar por `event_id`
- 🔄 `POST /api/uploads/layout` → guardar en `event_layouts`
- 🔄 Schema: de `layout_settings` (1 registro) → `event_layouts` (N registros)

