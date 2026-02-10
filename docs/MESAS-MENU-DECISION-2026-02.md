# Menú "Mesas" - Nuevo Propósito

## ⚠️ Cambio de Arquitectura

### ANTES (V1)
- Menú "Mesas" era el punto principal de gestión
- Se creaban mesas directamente desde ahí
- Estaban ligadas a eventos (duplicación masiva)

### AHORA (V2)
El menú "Mesas" tiene **dos posibles usos**:

---

## 🎯 Opción 1: Vista Global de Solo Lectura

**Propósito:** Ver todas las mesas de todos los organizadores en un solo lugar.

**Uso:**
- Auditoría rápida
- Búsqueda cross-organizador
- Reportes consolidados
- **SIN edición** (solo consulta)

**Ruta:** `/admin/tables`

---

## 🎯 Opción 2: Eliminar Completamente (Recomendado)

**Razón:**
- Flujo principal ahora es `/admin/organizers` → Gestionar Mesas
- Evita confusión sobre dónde crear mesas
- Mantiene claridad: "cada organizador gestiona sus mesas"

**Acción sugerida:**
```tsx
// apps/backoffice/app/admin/tables/page.tsx
export default function TablesPage() {
  redirect('/admin/organizers')
}
```

---

## ✅ Flujo Correcto AHORA

### 1️⃣ Configuración Inicial (DESDE ORGANIZADORES)
```
/admin/organizers
  ↓ Click en organizador
  ↓ Botón "🪑 Gestionar Mesas"
/admin/organizers/[id]/tables
  ↓ Crear mesas aquí
```

### 2️⃣ Diseño de Croquis
```
/admin/organizers
  ↓ Click en organizador
  ↓ Botón "📐 Diseñar Croquis"
/admin/organizers/[id]/layout
  ↓ Arrastar mesas, subir fondo
```

### 3️⃣ Configuración por Evento
```
/admin/events/[id]
  ↓ Botón "⚙️ Configurar Mesas"
/admin/events/[id]/tables
  ↓ Activar/desactivar
  ↓ Precios custom
```

---

## 🗺️ Navegación Recomendada

### Sidebar Actual
```
OPERACIONES
  📊 Inicio
  🏢 Organizadores ← PUNTO PRINCIPAL
  📅 Eventos
  🪑 Mesas         ← DEPRECAR O HACER SOLO LECTURA
  📋 Reservas
  🎫 Tickets/QR
```

### Sidebar Recomendado
```
OPERACIONES
  📊 Inicio
  🏢 Organizadores ← GESTIÓN DE MESAS AQUÍ
  📅 Eventos
  📋 Reservas
  🎫 Tickets/QR

REPORTES
  📈 Asistencia
  💰 Ingresos
  🪑 Uso de Mesas ← VISTA CONSOLIDADA (opcional)
```

---

## 💡 Decisión Final

**Pregunta clave:** ¿Necesitas ver todas las mesas de todos los organizadores en un solo lugar?

- **SÍ** → Mantener `/admin/tables` como vista de solo lectura/reporte
- **NO** → Eliminar ruta y redirigir a `/admin/organizers`

**Recomendación:** Empezar con **redirect** y evaluar si hace falta vista consolidada después.

---

## 🔧 Implementación Sugerida

```typescript
// apps/backoffice/app/admin/tables/page.tsx
import { redirect } from "next/navigation";

export default function TablesPage() {
  // Redirigir al nuevo flujo
  redirect('/admin/organizers');
}
```

Esto mantiene la ruta funcionando (no rompe links existentes) pero guía al usuario al flujo correcto.

---

**Fecha:** 2026-02-08  
**Status:** ✅ Build exitoso, esperando decisión sobre menú Mesas
