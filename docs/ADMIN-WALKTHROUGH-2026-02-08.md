# 📖 ADMIN WALKTHROUGH: Sistema Multi-Organizador + Gestión de Mesas

**Fecha**: 8 de febrero de 2026  
**Audiencia**: Admin/Backoffice User  
**Objetivo**: Guía completa para crear eventos, mesas y gestionar layouts

---

## 🎯 Flujo General (End-to-End)

```
1. Crear Organizador (si no existe)
   ↓
2. Crear Evento → Activar
   ↓
3. Agregar Mesas al evento
   ↓
4. Posicionar mesas en el plano (Canvas)
   ↓
5. [OPCIONAL] Copiar layout de evento anterior
   ↓
6. Cerrar evento → Las mesas se archivan automáticamente
```

---

## 1️⃣ Crear un Organizador (Admin/DB Only)

**¿Cuándo?** Una sola vez por cada marca/lugar (Colorimetría, BabyClub, etc)

### Opción A: Via Supabase Dashboard

```sql
INSERT INTO public.organizers (slug, name, is_active, created_at, updated_at)
VALUES (
  'babyclub',                          -- slug único (usado internamente)
  'Baby Club',                         -- nombre visible
  true,                                -- activo
  NOW(),
  NOW()
);
```

**Resultado**: Se genera automáticamente un `id` (uuid)

### Opción B: En Backoffice (cuando esté implementada UI)
*(Por ahora, solo vía SQL)*

---

## 2️⃣ Crear un Evento

**Ubicación en Backoffice**: `Admin → Eventos → Nuevo`

### Paso 1: Llenar formulario básico

| Campo | Ejemplo | Notas |
|-------|---------|-------|
| **Nombre** | "LOVE IS A DRUG" | Visible en landing |
| **Descripción** | "Noche de electrónica" | Descripción completa |
| **Fecha/Hora** | 15/02/2026, 22:00 | Hora limite de entrada |
| **Organizador** | Baby Club | Se selecciona automáticamente (el único activo) |
| **Es Activo** | ✅ Sí | Permite ventas |

### Paso 2: Guardar evento

→ El evento queda **activo** y **listo para vender**

**Datos generados automáticamente**:
- ✅ `event_id` (uuid)
- ✅ `organizer_id` (vinculado a Baby Club)
- ✅ `created_at`, `is_active = true`

---

## 3️⃣ Agregar Mesas al Evento

**Ubicación**: `Admin → Mesas → Crear Mesa` o `Admin → Eventos → [Evento] → Agregar Mesas`

### Paso 1: Ir a sección de Mesas

1. Abre Backoffice
2. Click en **Admin** (izquierda)
3. Click en **Mesas**
4. Verás lista de mesas (solo de tu organizador)

### Paso 2: Crear nueva mesa

Click en **+ Nueva Mesa**

### Paso 3: Llenar datos

| Campo | Ejemplo | Notas |
|-------|---------|-------|
| **Nombre** | "Mesa 1" | ID visible en plano |
| **Tickets** | 4 | Capacidad de personas |
| **Min. Consumo** | 50.00 | En moneda local (PEN) |
| **Precio** | 150.00 | Costo total entrada+consumo |
| **Activa** | ✅ Sí | Disponible para venta |
| **Notas** | "Esquina izq" | Para admin |
| **Evento** | LOVE IS A DRUG | Debe estar activo |

### Paso 4: Guardar

→ Mesa creada con `organizer_id` = Baby Club automáticamente

**Repetir para todas las mesas** (6 en el ejemplo)

---

## 4️⃣ Posicionar Mesas en el Plano (Canvas)

**Ubicación**: `Admin → Mesas → Plano de Mesas`

### Paso 1: Abrir editor de layout

1. Click en **Plano de Mesas** (en menú lateral)
2. Se carga automáticamente el evento activo + sus mesas

### Paso 2: Entender el canvas

```
╔─ Canvas 0-100% (responsive) ─╗
║                               ║
║    [Mesa 1]  [Mesa 2]        ║
║                               ║
║    [Mesa 3]  [Mesa 4]        ║
║                               ║
╚───────────────────────────────╝

- X: 0-100% (izquierda a derecha)
- Y: 0-100% (arriba a abajo)
- W, H: Ancho/alto en %
```

### Paso 3: Posicionar mesas (Drag & Drop)

1. Click en mesa → Arrastra a posición
2. Redimensiona si es necesario
3. Posición se guarda automáticamente

**Ejemplo de distribución**:
```
Mesa 1: X=10%, Y=20%, W=20%, H=20%
Mesa 2: X=50%, Y=20%, W=20%, H=20%
Mesa 3: X=10%, Y=55%, W=20%, H=20%
Mesa 4: X=50%, Y=55%, W=20%, H=20%
```

### Paso 4: Subir fondo/plano (opcional)

Click en **Subir Plano** → Selecciona imagen de fondo
- Recomendado: PNG/JPG 1920x1080
- Se guarda en `layout_settings`

**Resultado**: Plano visual listo para cliente

---

## 5️⃣ [NUEVO] Copiar Layout de Evento Anterior

**Ubicación**: `Admin → Mesas → Plano de Mesas → Botón "Copiar Layout"`

### Escenario

> Tienes evento "LOVE IS A DRUG" con 6 mesas distribuidas.  
> Ahora creas "LAST DANCE" con misma distribución.

### Paso 1: Crear evento nuevo

- Nombre: "LAST DANCE"
- Organizador: Baby Club
- Crear mesas vacías (sin posiciones)

### Paso 2: En el plano del nuevo evento

1. Click en **"Copiar Layout"** (botón azul)
2. Se abre selector con eventos anteriores cerrados
3. Selecciona **"LOVE IS A DRUG"** (evento anterior)
4. Click en **"Copiar"**

### Paso 3: Validar

✅ Las 6 mesas aparecen con **mismas posiciones X, Y, W, H**  
✅ Se copia también el background del plano  
✅ Ahorro: ~30 minutos de reposicionamiento

**Detrás de escenas**:
- API DELETE SOFT (marca con `deleted_at`) mesas viejas del nuevo evento
- Inserta copias con `organizer_id` = Baby Club
- Copia `layout_settings` (background + canvas_width)

---

## 6️⃣ Cerrar Evento (End of Night)

**Ubicación**: `Admin → Eventos → [Evento] → Cerrar`

### Antes de cerrar

```
Estado:
- Evento: LOVE IS A DRUG (activo ✅)
- Mesas: 6 mesas (algunas con reservaciones)
- Reservaciones activas: Mesa 1 (pending), Mesa 3 (paid)
```

### Paso 1: Click en "Cerrar Evento"

Pop-up de confirmación:
> "¿Cerrar evento? Esto archivará todas las reservaciones activas."

### Paso 2: Confirmar

→ **Automáticamente**:
1. ✅ Evento: `is_active = false`, `closed_at = NOW()`
2. ✅ Reservaciones: Se marcan con `deleted_at = NOW()`, `status = 'archived'`
3. ✅ Mesas: Quedan en la BD (sin borrar, soft delete ready)

### Paso 3: Verificar cierre

En Supabase (para validar):
```sql
SELECT 
  e.name,
  e.is_active,
  e.closed_at,
  COUNT(r.id) as reservaciones_archivadas
FROM public.events e
LEFT JOIN public.table_reservations r ON e.id = r.event_id AND r.deleted_at IS NOT NULL
WHERE e.id = 'event_id_aqui'
GROUP BY e.id, e.name, e.is_active, e.closed_at;
```

**Resultado esperado**:
- `is_active = false`
- `closed_at = 2026-02-08 04:30:00` (timestamp)
- `reservaciones_archivadas = 2`

### Paso 4: Crear nuevo evento

Ahora puedes:
1. Crear "LAST DANCE" nuevo evento
2. Usar **Copiar Layout** para reutilizar mesas

→ Las 6 mesas de "LOVE IS A DRUG" ahora están disponibles en selector

---

## 🔒 Aislamiento Multi-Organizador (Invisible para Admin)

**Detrás de escenas**, el sistema garantiza:

### Protección Automática

```
✅ Admin solo ve mesas de su organizador (Baby Club)
✅ Las queries filtran por organizer_id automáticamente
✅ NO es posible ver/modificar mesas de otro organizador (Colorimetría)
✅ Las APIs lanzan error 403 si intenta acceder
```

### Ejemplo

```
Admin Baby Club abre panel:
→ Ve 6 mesas de Baby Club ✅

Admin Colorimetría abre panel:
→ Ve 0 mesas (no tiene mesas aún) ✅

Si Admin Baby Club intenta copiar layout de Colorimetría:
→ 403 Forbidden ✅ (error automático)
```

**No necesitas hacer nada** - está automatizado.

---

## 📊 Tablas Involucradas

Para entender qué pasa detrás:

| Tabla | Qué guarda | Organizer Filtered |
|-------|-----------|-------------------|
| `organizers` | Marcas (Baby Club, Colorimetría) | No (global) |
| `events` | Eventos por organizador | Sí (`organizer_id`) |
| `tables` | Mesas (NEW: `organizer_id`) | Sí (`organizer_id`) |
| `table_reservations` | Reservas de mesas | Sí (vía `table_id`) |
| `layout_settings` | Posiciones + background | Sí (`organizer_id`) |

---

## 🆘 Troubleshooting

### Problema: "No veo mis mesas en el panel"

**Causa**: Mesas creadas sin `organizer_id` (datos legacy)

**Solución**:
```sql
-- En Supabase, ejecutar:
UPDATE public.tables 
SET organizer_id = '04831d27-5b06-48f5-b553-fbb62e04af52'  -- Baby Club ID
WHERE organizer_id IS NULL;
```

### Problema: "Copiar Layout no funciona"

**Causa**: Evento anterior no tiene estado `is_active = false`

**Solución**: Asegúrate que evento origen esté **cerrado** (status: closed)

### Problema: "¿Qué pasa si borro una mesa?"

**Respuesta**: No se borra (soft delete):
- Se marca con `deleted_at = NOW()`
- Sigue existiendo en BD
- Las queries la ignoran automáticamente

**Rollback**: Actualizar `deleted_at = NULL` en Supabase

---

## ✅ Checklist de Operación (Daily)

Antes de cada evento:

- [ ] Evento **activo** (`is_active = true`)
- [ ] Todas las mesas tienen `organizer_id` ✅
- [ ] Plano visible (canvas + background)
- [ ] Stock de entradas disponible
- [ ] Códigos de promoción activados (si aplica)

Después del evento:

- [ ] Click en **"Cerrar Evento"**
- [ ] Validar que reservaciones están archivadas
- [ ] Generar reporte de ventas
- [ ] Preparar próximo evento

---

## 📞 Soporte

**Si algo no funciona**:

1. Ejecuta queries de diagnóstico (ver `MIGRACION-EXITOSA-2026-02-08.md`)
2. Abre Supabase dashboard → SQL editor
3. Compartí resultados al equipo técnico

**Datos útiles a compartir**:
- Screenshot del error
- `event_id` afectado
- `organizer_id` de tu usuario
- Timestamp exacto

---

## 📚 Referencias

- **Docs técnicas**: `MIGRACION-EXITOSA-2026-02-08.md`
- **ADR arquitectura**: `docs/adr/2026-02-08-006-multi-organizer-layout.md`
- **Esquema BD**: Ver `AGENTS.md` → "Decisiones operativas"

---

**Status**: ✅ Listo para usar en producción

Próximo paso: [Deploy a Vercel](https://vercel.com/rapha) cuando confirmes que flujo completo funciona.
