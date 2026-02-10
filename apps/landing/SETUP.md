# Guía de Configuración - BABY Landing

## Paso 1: Obtener el ID del organizador BABY

Ejecuta en tu base de datos:

```sql
SELECT id, name, slug FROM public.organizers WHERE name ILIKE '%baby%';
```

Copia el `id` que obtengas (será un UUID como `123e4567-e89b-12d3-a456-426614174000`)

## Paso 2: Obtener el ID del evento activo

```sql
SELECT id, name, starts_at, is_active 
FROM public.events 
WHERE organizer_id = '<uuid-de-baby>' 
  AND is_active = true
ORDER BY starts_at DESC
LIMIT 1;
```

## Paso 3: Configurar .env.local

Crea un archivo `.env.local` en `apps/landing/` con:

```bash
# Supabase (copiar de .env o Vercel)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...

# Organizador BABY
NEXT_PUBLIC_ORGANIZER_ID=<pega-aqui-el-uuid-de-baby>
NEXT_PUBLIC_ORGANIZER_NAME=BABY

# Código de acceso por defecto
NEXT_PUBLIC_DEFAULT_CODE=LOVEISLOVE

# Método de pago (dejar en reservation hasta tener Izipay)
PAYMENT_METHOD=reservation
ENABLE_ONLINE_PAYMENTS=false

# API Perú (para validar DNI)
API_PERU_TOKEN=<tu-token>

# Email (Resend)
RESEND_API_KEY=<tu-key>
RESEND_FROM=noreply@baby.club
```

## Paso 4: Subir el croquis de BABY

```sql
-- Insertar layout específico para BABY
INSERT INTO public.layout_settings (
  organizer_id, 
  event_id, 
  layout_url,
  canvas_width,
  canvas_height
)
VALUES (
  '<uuid-de-baby>',
  '<uuid-del-evento-activo>',
  'https://tu-cdn.com/baby-venue-map.png',
  800,
  600
)
ON CONFLICT (organizer_id, event_id) 
DO UPDATE SET 
  layout_url = EXCLUDED.layout_url,
  updated_at = now();
```

## Paso 5: Verificar configuración

```bash
# Iniciar servidor
pnpm dev:landing

# Verificar que solo aparecen mesas de BABY
curl "http://localhost:3001/api/tables?organizer_id=<uuid-de-baby>"

# Verificar que aparece el layout correcto
curl "http://localhost:3001/api/layout?organizer_id=<uuid-de-baby>&event_id=<uuid-evento>"
```

## Troubleshooting

### No aparecen mesas
- Verifica que las mesas en BD tienen el `organizer_id` de BABY
- Ejecuta:
```sql
UPDATE public.tables 
SET organizer_id = '<uuid-de-baby>'
WHERE event_id IN (
  SELECT id FROM public.events WHERE organizer_id = '<uuid-de-baby>'
);
```

### No aparece el croquis
- Verifica que el `layout_url` sea accesible públicamente
- Verifica que existe el registro en `layout_settings`
- Fallback: Configurar `NEXT_PUBLIC_TABLE_LAYOUT_URL` en .env

### Aparecen mesas de otros organizadores
- Verifica que `NEXT_PUBLIC_ORGANIZER_ID` esté configurado
- Verifica que las mesas tengan el `organizer_id` correcto

## Para Producción (Vercel)

Agregar las siguientes variables de entorno en Vercel:

1. `NEXT_PUBLIC_ORGANIZER_ID` = `<uuid-de-baby>`
2. `NEXT_PUBLIC_ORGANIZER_NAME` = `BABY`
3. `PAYMENT_METHOD` = `reservation`
4. `ENABLE_ONLINE_PAYMENTS` = `false`

**Importante**: Cuando Izipay esté listo, solo cambiar:
- `PAYMENT_METHOD` = `izipay`
- `ENABLE_ONLINE_PAYMENTS` = `true`
- Agregar credenciales de Izipay
