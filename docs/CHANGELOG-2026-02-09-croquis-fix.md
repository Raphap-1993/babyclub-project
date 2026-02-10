# Corrección del Flujo de Croquis Multi-Organizador

**Fecha**: 2026-02-09  
**Problema**: El croquis del organizador BABY no se estaba mostrando en la landing

## Problema Identificado

El sistema tenía **dos lugares** donde se guardaban los croquis:
1. `organizers.layout_url` - Donde el backoffice **SÍ** guarda el croquis
2. `layout_settings` - Tabla nueva que **NO** se está usando actualmente

El API `/api/layout` del landing estaba consultando `layout_settings`, pero el backoffice guarda en `organizers.layout_url`.

## Solución Implementada

### 1. Corrección del API `/api/layout`

**Archivo**: `apps/landing/app/api/layout/route.ts`

**Cambio**: Ahora consulta directamente `organizers.layout_url` usando el `NEXT_PUBLIC_ORGANIZER_ID`:

```typescript
// Main source: organizers.layout_url (donde se sube desde el backoffice)
if (organizerId) {
  const { data: organizerData } = await applyNotDeleted(
    supabase
      .from('organizers')
      .select('layout_url')
      .eq('id', organizerId)
  ).maybeSingle();

  if (organizerData?.layout_url) {
    return NextResponse.json({ 
      layout_url: organizerData.layout_url
    });
  }
}
```

### 2. Configuración del `.env.local`

**Archivo**: `apps/landing/.env.local`

Agregadas las siguientes variables:
```bash
# Multi-organizador: ID del organizador actual (BABY)
NEXT_PUBLIC_ORGANIZER_ID=04831d27-5b06-48f5-b553-fbb62e04af52
NEXT_PUBLIC_ORGANIZER_NAME=BABY

# Payment Methods Configuration
PAYMENT_METHOD=reservation
ENABLE_ONLINE_PAYMENTS=false
```

### 3. Corrección del `.env.example`

**Problema**: Había un espacio después del `=` que causaba que el ID se leyera incorrectamente:
```bash
# ❌ ANTES (con espacio)
NEXT_PUBLIC_ORGANIZER_ID= 04831d27-5b06-48f5-b553-fbb62e04af52

# ✅ DESPUÉS (sin espacio)
NEXT_PUBLIC_ORGANIZER_ID=04831d27-5b06-48f5-b553-fbb62e04af52
```

## Flujo Correcto End-to-End

### A. Desde el Backoffice (Gestión de Croquis)

1. **Ir a**: `/admin/organizers`
2. **Click en**: Botón "📐 Diseñar Croquis" del organizador BABY
3. **Ruta**: `/admin/organizers/04831d27-5b06-48f5-b553-fbb62e04af52/layout`
4. **Subir imagen**: Componente `OrganizerLayoutClient.tsx`
5. **Se guarda en**: `organizers.layout_url` (tabla `organizers`, campo `layout_url`)
6. **API usada**: `POST /api/uploads/layout`
7. **Persistencia**: `PUT /api/organizers/[id]/layout`

### B. Desde la Landing (Visualización de Croquis)

1. **Usuario accede**: `/compra`
2. **Page**: `apps/landing/app/compra/page.tsx`
3. **useEffect carga layout**:
   ```typescript
   useEffect(() => {
     const params = new URLSearchParams();
     if (organizerId) params.append('organizer_id', organizerId);
     
     fetch(`/api/layout?${params.toString()}`)
       .then(res => res.json())
       .then(data => setLayoutUrl(data?.layout_url || null));
   }, [organizerId]);
   ```
4. **API**: `GET /api/layout?organizer_id=04831d27-...`
5. **Consulta BD**: `SELECT layout_url FROM organizers WHERE id = '04831d27-...'`
6. **Renderiza**: `<MiniTableMap layoutUrl={layoutUrl} ... />`

### C. Filtro de Mesas por Organizador

El sistema **también** filtra las mesas por organizador:

```typescript
useEffect(() => {
  const params = new URLSearchParams();
  if (organizerId) params.append('organizer_id', organizerId);
  if (selectedEventId) params.append('event_id', selectedEventId);
  
  fetch(`/api/tables?${params.toString()}`)
    .then(res => res.json())
    .then(data => setTables(data?.tables || []));
}, [selectedEventId, organizerId]);
```

**API**: `GET /api/tables?organizer_id=04831d27-...&event_id=xxx`

**Resultado**: Solo mesas del organizador BABY para el evento seleccionado.

## Arquitectura de Datos

```
organizers (tabla principal)
├── id (PK)
├── name
├── slug
└── layout_url  ← 🎯 AQUÍ SE GUARDA EL CROQUIS

tables (mesas del organizador)
├── id (PK)
├── organizer_id (FK → organizers.id)
├── event_id (FK → events.id)
├── name
├── layout_x (posición X en el croquis)
├── layout_y (posición Y en el croquis)
└── layout_size (tamaño del círculo/mesa)

layout_settings (tabla nueva, NO USADA actualmente)
├── id (PK)
├── organizer_id (FK)
├── event_id (FK)
├── layout_url
├── canvas_width
├── canvas_height
└── scale
```

## Estado Actual

### ✅ Funcionalidades Correctas

1. **Backoffice**: Sube y guarda croquis en `organizers.layout_url`
2. **Landing**: Lee croquis desde `organizers.layout_url`
3. **Filtro de mesas**: Por `organizer_id` + `event_id`
4. **Env vars**: Configuradas correctamente en `.env.local`

### ⚠️ Para Verificar

1. **Ejecutar SQL**: `scripts/verify-baby-config.sql` en Supabase
2. **Verificar que existe**: `organizers.layout_url` con una URL válida
3. **Probar**: Reiniciar servidor (`pnpm dev:landing`) y verificar en `/compra`
4. **Consola del navegador**: Ver si aparece la URL del croquis

## Próximos Pasos

1. **Ejecutar el script SQL** para verificar configuración de BABY
2. **Reiniciar el servidor** de landing para cargar nuevas env vars
3. **Probar** acceso a `/compra` y verificar que se muestre el croquis correcto
4. **Si no hay croquis**: Ir a backoffice y subirlo desde `/admin/organizers/[id]/layout`

## Migración Futura (Opcional)

Si en el futuro queremos usar `layout_settings` (croquis por evento en vez de por organizador):

1. Migrar datos de `organizers.layout_url` → `layout_settings`
2. Actualizar backoffice para guardar en `layout_settings`
3. El API `/api/layout` ya tiene fallback preparado para esto
4. Mantener compatibilidad con sistema actual

## Comandos Útiles

```bash
# Reiniciar landing con nuevas env vars
cd /Users/rapha/Projects/babyclub-monorepo
pnpm dev:landing

# Verificar variables de entorno cargadas
echo $NEXT_PUBLIC_ORGANIZER_ID

# Probar API manualmente
curl "http://localhost:3000/api/layout?organizer_id=04831d27-5b06-48f5-b553-fbb62e04af52"

# Probar API de mesas
curl "http://localhost:3000/api/tables?organizer_id=04831d27-5b06-48f5-b553-fbb62e04af52"
```

## Archivos Modificados

1. ✅ `apps/landing/app/api/layout/route.ts` - Corregido para leer de `organizers`
2. ✅ `apps/landing/.env.local` - Agregado `NEXT_PUBLIC_ORGANIZER_ID`
3. ✅ `apps/landing/.env.example` - Corregido espacio en ORGANIZER_ID
4. ✅ `scripts/verify-baby-config.sql` - Script de verificación

## Conclusión

El problema era que el API estaba buscando en la tabla equivocada. Ahora está corregido para leer desde `organizers.layout_url`, que es donde el backoffice ya guarda los croquis.

**No necesitas subir el croquis nuevamente**, solo asegúrate de que:
1. El croquis ya está en `organizers.layout_url` (verificar con SQL)
2. El servidor de landing se reinicie para cargar las nuevas env vars
3. El `NEXT_PUBLIC_ORGANIZER_ID` esté configurado correctamente
