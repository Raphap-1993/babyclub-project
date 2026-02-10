# Auditoría: Flujo de Reserva de Mesas (Registro)
**Fecha**: 9 de febrero de 2026
**Archivo**: `apps/landing/app/registro/page.tsx`

## Problema Reportado
El sistema de reserva de mesas no lista correctamente las mesas disponibles.

## Análisis End-to-End

### 1. API `/api/tables` ✅
**Estado**: Funcionando correctamente
- Endpoint: `http://localhost:3001/api/tables`
- Retorna: 6 mesas activas
- Formato nombres: "Mesa 1", "Mesa 2", "Mesa 3", "Mesa 4", "Mesa 5", "Mesa 6"
- Campo `is_reserved`: Calculado correctamente en backend
- Productos: Incluidos y filtrados (solo activos)

**Ejemplo de respuesta**:
```json
{
  "id": "10ef9ed0-9933-4cca-ad8a-4f12d695b4d5",
  "name": "Mesa 1",
  "ticket_count": 5,
  "min_consumption": 80,
  "price": 80,
  "is_reserved": false,
  "pos_x": 24,
  "pos_y": 8.5,
  "pos_w": 10,
  "pos_h": 8,
  "products": [...]
}
```

### 2. Carga de Datos en Frontend ✅
**Estado**: Funcionando correctamente

```typescript
fetch("/api/tables", { cache: "no-store" })
  .then((res) => res.json())
  .then((data) => {
    const loadedTables = data?.tables || [];
    setTables(loadedTables); // ✅ Estado actualizado
    const firstTable = loadedTables.find((t: any) => !t.is_reserved) || loadedTables?.[0];
    setSelectedTable(firstTable?.id || ""); // ✅ Selección inicial
    const firstProduct = firstTable?.products?.find((p: any) => p.is_active !== false);
    setSelectedProduct(firstProduct?.id || "");
  })
```

### 3. Mapeo a Slots del Mapa ⚠️ CORREGIDO
**Estado anterior**: FALLABA - usaba `slot.id === t.id` (comparaba "M1" con UUID)
**Estado actual**: CORREGIDO - usa `findTableForSlot(slot.label, tables)`

**Función de mapeo**:
```typescript
const tableSlots = useMemo(() => {
  return TABLES.map((slot) => {
    const table = findTableForSlot(slot.label, tables); // ✅ Busca por nombre
    if (!table) {
      return { /* slot sin mesa */ };
    }
    return {
      id: table.id, // ✅ UUID real de BD
      label: table.name,
      x, y, width, height,
      reserved: !!table.is_reserved,
    };
  });
}, [tables]);
```

**Función findTableForSlot**:
```typescript
const normalizeTableName = (name: string) => name.replace(/\s+/g, "").toLowerCase();

function findTableForSlot(label: string, tables: TableInfo[]) {
  const normalizedLabel = label.toLowerCase(); // "1"
  return (
    tables.find((t) => normalizeTableName(t.name).includes(normalizedLabel)) || // "mesa1"
    tables.find((t) => normalizeTableName(t.name).includes(`mesa${normalizedLabel}`)) || // "mesa1"
    tables.find((t) => normalizeTableName(t.name).includes(`table${normalizedLabel}`)) || // "table1"
    null
  );
}
```

### 4. Componente SimpleTableMap ✅
**Estado**: Funcionando correctamente
- Recibe `slots` con IDs de UUID reales
- Click en mesa → `onSelect(id)` → `setSelectedTable(realUUID)`
- Renderiza SVG overlay sobre imagen con Next.js Image

### 5. Sincronización de Estados ✅
**Estado**: Funcionando correctamente

**Estados relacionados**:
- `tables`: Array de mesas de BD (con UUIDs)
- `tableSlots`: Array mapeado para el mapa (con UUIDs)
- `selectedTable`: UUID de la mesa seleccionada
- `selectedProduct`: UUID del pack seleccionado
- `tableInfo`: Mesa completa encontrada por UUID

**Flujo de selección**:
1. Usuario hace click en mapa → `onSelect(UUID)` → `setSelectedTable(UUID)`
2. Usuario hace click en lista → `onClick={() => setSelectedTable(UUID)}`
3. `tableInfo` se actualiza automáticamente vía `useMemo`
4. `products` se extrae de `tableInfo.products`

### 6. UI de Tabs ✅
**Estado**: Implementado correctamente

**Tabs disponibles**:
- **Mesa**: Info de mesa seleccionada + lista rápida de todas las mesas
- **Packs**: Lista de packs disponibles para la mesa seleccionada
- **Datos**: Formulario de reserva

### 7. Validación de Reserva ⚠️
**Estado**: Mejorable

**Validaciones actuales**:
```typescript
if (!selectedTable) {
  setReservationError("Selecciona una mesa"); // ✅
  return;
}
if (!validateDocument(...) || !reservationFullName) {
  setReservationError("Ingresa documento y nombres..."); // ✅
  return;
}
if (products.length > 0 && !selectedProduct) {
  setReservationError("Elige un pack para tu mesa"); // ✅
  return;
}
```

**Recomendación**: Agregar feedback visual cuando no hay mesa seleccionada.

## Correcciones Aplicadas

### Fix 1: Mapeo de Slots ✅
**Antes**:
```typescript
const table = tables.find((t) => t.id === slot.id); // ❌ "M1" !== UUID
```

**Después**:
```typescript
const table = findTableForSlot(slot.label, tables); // ✅ Busca "1" en "Mesa 1"
```

### Fix 2: SimpleTableMap (sin zoom) ✅
- Eliminada dependencia `react-zoom-pan-pinch`
- Usa `next/image` + SVG overlay
- Interacción directa con mesas
- Aspecto ratio preservado

### Fix 3: Sistema de Tabs ✅
- Elimina scroll oculto
- Navegación clara entre secciones
- Mejor experiencia móvil

## Estado Final

### ✅ Funcionando Correctamente
1. Carga de mesas desde API
2. Mapeo de mesas a slots del mapa
3. Interacción con mapa (click en mesas)
4. Lista rápida de mesas
5. Selección de packs
6. Formulario de datos
7. Validaciones de reserva
8. Sistema de tabs

### ⚠️ Puntos de Atención
1. **Posicionamiento del mapa**: Las coordenadas `pos_x`, `pos_y` en BD pueden no coincidir exactamente con el diseño visual del PNG
2. **Mesas fuera de TABLES**: Si hay mesas en BD que no están en el array `TABLES`, solo aparecerán en la lista rápida, no en el mapa
3. **Sincronización organizer_id**: Verificar que el filtro por organizador funcione cuando se implemente multi-organización

### 🔍 Recomendaciones

1. **Agregar logs de debugging temporal**:
```typescript
console.log('Tables loaded:', tables.length);
console.log('Table slots mapped:', tableSlots.length);
console.log('Table slots with data:', tableSlots.filter(s => !s.reserved).length);
```

2. **Agregar indicador visual de carga**:
```typescript
{tables.length === 0 && <LoadingSpinner />}
```

3. **Mostrar mensaje cuando no hay mesas**:
```typescript
{tables.length === 0 && !loading && (
  <div>No hay mesas disponibles</div>
)}
```

4. **Validar coordinates del mapa**:
- Verificar que `pos_x`, `pos_y` en BD correspondan con el archivo PNG
- Considerar ajustar coordenadas si el mapa visual no coincide

## Conclusión

El flujo end-to-end está funcionando correctamente después de las correcciones aplicadas. El problema principal era el mapeo de slots que comparaba IDs fijos ("M1") con UUIDs de base de datos. Ahora usa búsqueda por nombre normalizado.

**Estado general**: ✅ **FUNCIONAL**

Si persiste algún problema de visualización, probablemente se deba a:
- Coordenadas del mapa que no coinciden con el diseño del PNG
- Mesas en BD sin correspondencia en el array `TABLES`
- Cache del navegador (hacer hard refresh)
