# Configuración de Supabase Storage

## Problema Común: "Error al subir la imagen del croquis"

Este error ocurre cuando el bucket de almacenamiento no está configurado en Supabase.

## Solución

### 1. Crear el bucket en Supabase

1. Ve a tu proyecto en [Supabase Dashboard](https://app.supabase.com)
2. En el menú lateral, haz clic en **Storage**
3. Haz clic en **New bucket**
4. Configuración del bucket:
   - **Name:** `event-assets`
   - **Public bucket:** ✅ Activar (para que las imágenes sean accesibles públicamente)
   - **File size limit:** 5 MB (o según necesites)
   - **Allowed MIME types:** Dejar vacío o añadir: `image/png,image/jpeg,image/webp,image/svg+xml`

5. Haz clic en **Create bucket**

### 2. Configurar políticas de acceso (RLS)

El bucket debe tener políticas que permitan:

#### Política de lectura pública (SELECT)
```sql
-- Permitir lectura pública
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'event-assets');
```

#### Política de escritura para usuarios autenticados (INSERT)
```sql
-- Permitir escritura a usuarios autenticados
CREATE POLICY "Authenticated users can upload"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-assets');
```

#### Política de actualización para usuarios autenticados (UPDATE)
```sql
-- Permitir actualización a usuarios autenticados
CREATE POLICY "Authenticated users can update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'event-assets')
WITH CHECK (bucket_id = 'event-assets');
```

### 3. Verificar configuración

Desde la consola de Supabase SQL Editor, ejecuta:

```sql
-- Verificar que el bucket existe
SELECT * FROM storage.buckets WHERE name = 'event-assets';

-- Verificar políticas
SELECT * FROM pg_policies 
WHERE schemaname = 'storage' 
AND tablename = 'objects';
```

### 4. Estructura recomendada del bucket

```
event-assets/
├── branding/
│   └── logo.png          (logo del organizador)
├── layouts/
│   └── [timestamp]-[filename].jpg  (croquis de mesas)
├── manifests/
│   └── [timestamp]-[filename].jpg  (manifiestos)
└── vouchers/
    └── [timestamp]-[filename].jpg  (comprobantes)
```

## Solución alternativa rápida (desde UI de Supabase)

1. Ve a **Storage** → **Policies**
2. Para el bucket `event-assets`:
   - Click en **New Policy**
   - Selecciona **For full customization** 
   - O usa templates: **Enable read access for all users** y **Enable insert for authenticated users only**

## Variables de entorno requeridas

Asegúrate de tener en tu `.env.local`:

```env
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
```

## Debugging

Si el error persiste, revisa los logs del servidor:

```bash
# En desarrollo
pnpm dev:backoffice

# Busca en la consola mensajes como:
# "Uploading to Supabase Storage: ..."
# "Supabase upload error: ..."
```

Los logs ahora incluyen información detallada sobre el bucket, path y error específico.
