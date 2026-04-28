# Runbook Operativo: entorno local aislado de produccion y clonado produccion -> local

Estado verificado en este repo el 2026-04-24.

## Objetivo

Levantar un entorno local que no toque produccion, dejar las apps apuntando a Supabase local y documentar el procedimiento para clonar datos de produccion hacia local cuando existan credenciales.

## Guardrails

- El runtime de desarrollo y las pruebas funcionales corren solo contra `localhost`.
- El proyecto remoto oficial para CLI es `babyclub-access` (`wtwnhqbbcocpnqqsybln`).
- El CLI remoto se usa para inventario, schema y deploy posterior, nunca como runtime de las apps.
- No ejecutar `supabase link`, `supabase db pull`, `supabase db push` ni `supabase db dump` contra remoto hasta validar el cambio en local y abrir una ventana de despliegue.
- No copiar `service_role` ni URLs remotas dentro de `apps/*/.env.local`.
- No ejecutar scripts que hoy estan hardcodeados al proyecto remoto `wtwnhqbbcocpnqqsybln`.

Scripts que no se deben ejecutar contra remoto sin validar entorno:

- `scripts/run-migration.sh`
- `scripts/run-migration.mjs`
- `scripts/check-migration.mjs`
- `scripts/migrate-table-availability.mjs`

## Estado actual del repo que condiciona el runbook

Hallazgos verificados el 2026-04-24:

- `supabase start` falla en esta maquina al intentar levantar `vector` por un mount hacia `~/.colima/default/docker.sock`.
- `supabase start --exclude vector` si levanta el stack util para este repo: `kong`, `auth`, `rest`, `storage`, `studio`, `mailpit`, `analytics` y `db`.
- `supabase status -o env` sigue reportando `imgproxy`, `vector` y `pooler` como detenidos; no bloquearon el flujo base validado.
- `supabase/config.toml` tiene `db.seed.enabled = true` y `sql_paths = ["./seed.sql"]`, pero `supabase/seed.sql` no existe.
- `supabase db reset --local --no-seed` no falla, pero omite todas las migraciones de `supabase/migrations/` porque sus nombres no cumplen el patron que espera el CLI (`<timestamp>_name.sql`).
- Resultado practico: despues del reset quedan solo los esquemas base de Supabase (`auth`, `storage`, etc.) y no quedan las tablas de negocio de BabyClub (`public.events`, `public.organizers`, `public.tables`, etc.).
- El repo ya incluye `supabase/seed.sql` vacio para que el start local no falle por seed faltante.
- `apps/landing/next.config.js` ya fue ampliado para aceptar assets locales (`localhost:54321`, `127.0.0.1:54321`, `localhost:4000`) y `*.supabase.co`.

Actualizacion operativa del 2026-04-25:

- El `Supabase CLI` ya fue autenticado en esta maquina con access token valido.
- `supabase projects list` ya muestra el proyecto remoto correcto: `babyclub-access` (`wtwnhqbbcocpnqqsybln`).
- Aun no se hizo `supabase link` del repo porque para `db pull` o `db push` sigue faltando la password de la base remota o un `db-url` operativo.
- Decision vigente: no tocar produccion hasta terminar la validacion en `localhost`.
- Ya existe una ruta operativa para clonar `public` de produccion hacia `localhost` sin `DATABASE_URL` remota, usando `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` del proyecto actual.
- Esa clonacion tambien exporta metadata de usuarios `auth` a JSON, pero no replica passwords reales de Auth.
- Para entrar al backoffice local despues del clon se debe crear un admin local nuevo sobre la BD clonada.

Consecuencia operativa:

- Hoy el flujo realista para tener datos utiles en local es `start --exclude vector -> reset --no-seed -> importar dump`.
- El flujo `start -> reset -> migraciones locales` no reconstruye el schema funcional del producto con el estado actual del repo.

## Prerequisitos

- Docker o Colima corriendo.
- `supabase` CLI instalado. Se verifico `2.90.0`.
- `pnpm` 9 y Node >= 18.
- Acceso de escritura a `apps/landing/.env.local` y `apps/backoffice/.env.local`.
- Un directorio local fuera del repo para guardar dumps temporales.

## 0. Preparar el CLI remoto sin usar prod como runtime

El CLI remoto y el runtime local son dos planos distintos:

- `Supabase CLI` -> inventario del proyecto remoto, futuras operaciones de schema y deploy.
- Apps `landing`, `backoffice`, `api` -> siempre apuntando al stack local en `localhost`.

Verificaciones seguras que si se pueden hacer desde ahora:

```bash
supabase projects list
supabase projects api-keys --project-ref wtwnhqbbcocpnqqsybln
```

Uso esperado:

- Confirmar que el proyecto Baby visible es `babyclub-access`.
- Confirmar que el CLI sigue autenticado antes de una tarea de schema o deploy.

Lo que no se hace todavia:

- `supabase link`
- `supabase db pull`
- `supabase db push`

Para esas operaciones luego hara falta uno de estos insumos:

- `SUPABASE_DB_PASSWORD` del proyecto remoto, o
- una `DATABASE_URL` remota valida para usar `--db-url`

## 0.1. Ruta operativa actual: clon remoto -> localhost sin password Postgres

Si el repo ya tiene `apps/backoffice/.env.local` o `apps/landing/.env.local` apuntando al proyecto remoto correcto y con `SUPABASE_SERVICE_ROLE_KEY`, se puede clonar el schema `public` y toda la data historica de negocio sin tocar produccion:

```bash
pnpm local:clone:public
```

Que hace:

- Resuelve el schema remoto con `supabase gen types typescript --project-id wtwnhqbbcocpnqqsybln --schema public`
- Genera un schema SQL local aproximado con PK/FK suficientes para PostgREST y los joins del producto
- Descarga la data de `public` via `service_role`
- Aplica schema y data en el Postgres local `localhost:54322`
- Exporta metadata de `auth.users` a JSON para trazabilidad

Archivos generados:

- `.local/clone/wtwnhqbbcocpnqqsybln.public.types.ts`
- `.local/clone/wtwnhqbbcocpnqqsybln.public.schema.sql`
- `.local/clone/wtwnhqbbcocpnqqsybln.public.data.sql`
- `.local/clone/wtwnhqbbcocpnqqsybln.auth.users.json`

Limitacion importante:

- Esta ruta clona `public` y metadata de `auth`, pero no replica las passwords reales de login.
- Por eso las credenciales de produccion no funcionan en `localhost`.

Para habilitar acceso al backoffice local:

```bash
pnpm local:create:admin -- --email local-admin@babyclub.local --password 'LocalBabyclub2026!'
```

Ese comando:

- crea o actualiza un usuario `auth` local
- crea o reutiliza `persons`
- crea o reutiliza un `staff` con rol administrativo real de la base clonada

Resultado esperado:

- login funcional en `http://localhost:3000/auth/login`
- usuario local aislado de produccion

## 1. Levantar Supabase local sin tocar produccion

Partir desde un estado limpio:

```bash
supabase stop
supabase start --exclude vector
```

Capturar variables efectivas del stack local:

```bash
supabase status -o env | rg '^[A-Z0-9_]+=' > /tmp/babyclub.supabase.env
cat /tmp/babyclub.supabase.env
```

Valores esperados en este repo cuando el stack queda sano:

- `API_URL=http://127.0.0.1:54321`
- `DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- `STUDIO_URL=http://127.0.0.1:54323`
- `INBUCKET_URL=http://127.0.0.1:54324`

Verificaciones minimas:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | rg 'supabase|NAMES'
supabase status -o env
```

Si `supabase start` falla con `supabase_vector_babyclub-monorepo`, repetir con `--exclude vector`. No continuar hasta tener `API_URL` y `DB_URL`.

Atajos ya preparados en el repo:

```bash
pnpm local:docker:up
pnpm local:docker:down
```

Notas:

- `pnpm local:docker:up` levanta Supabase local, genera `.env.local.localstack` para las apps y luego arranca `landing`, `backoffice` y `api` en Docker.
- Si no le pasas un dump, deja el stack arriba pero te advierte que la BD sigue sin schema de negocio.
- Tambien existe `pnpm local:stack` como wrapper rapido host-side para diagnostico; no es la ruta principal si quieres apps containerizadas.

## 2. Apuntar las apps al stack local

Crear los `.env.local` desde los ejemplos del repo:

```bash
cp apps/landing/.env.example apps/landing/.env.local
cp apps/backoffice/.env.example apps/backoffice/.env.local
```

Cargar variables locales de Supabase en la shell actual:

```bash
source /tmp/babyclub.supabase.env
```

Mapeo que deben usar las apps:

- `SUPABASE_URL=$API_URL`
- `SUPABASE_SERVICE_ROLE_KEY=$SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY=$ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_URL=$API_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY=$ANON_KEY`
- `NEXT_PUBLIC_APP_URL=http://localhost:3001`
- `NEXT_PUBLIC_LANDING_URL=http://localhost:3001`
- `ENABLE_CULQI_PAYMENTS=false`

Checklist de aislamiento:

- `apps/landing/.env.local` no debe contener `.supabase.co`.
- `apps/backoffice/.env.local` no debe contener `.supabase.co`.
- Ningun `.env.local` debe contener `wtwnhqbbcocpnqqsybln`.

Chequeo rapido:

```bash
rg -n 'wtwnhqbbcocpnqqsybln|supabase\.co' apps/landing/.env.local apps/backoffice/.env.local
```

Resultado esperado: cero matches.

## 3. Reset y migrate de Supabase local

Reset seguro del stack local:

```bash
supabase db reset --local --no-seed
```

Por que `--no-seed`:

- `supabase/config.toml` referencia `supabase/seed.sql`.
- Ese archivo no existe hoy en el repo.

Que hace realmente este reset hoy:

- Resetea los esquemas base del stack local.
- No aplica las migraciones de `supabase/migrations/` por el patron de nombres actual.
- No deja lista la base de negocio de BabyClub.

Validacion despues del reset:

```bash
source /tmp/babyclub.supabase.env
psql "$DB_URL" -Atc "select schemaname || '.' || tablename from pg_tables where schemaname not in ('pg_catalog','information_schema') order by 1;"
```

Si el resultado no incluye tablas de `public` como `public.events` o `public.organizers`, el comportamiento es el esperado para el estado actual del repo y se debe continuar con la importacion del dump.

## 4. Procedimiento de clonado produccion -> local

### 4.1. Insumos requeridos

- `PROD_DB_URL` con permiso de lectura sobre la base de produccion.
- Confirmacion de si el dump debe ir sanitizado o no.
- Una carpeta local fuera del repo para guardar los archivos SQL.

Recomendacion:

- Guardar dumps en una ruta no trackeada, por ejemplo `~/tmp/babyclub-clones/<fecha-hora>/`.
- Usar credenciales de solo lectura.
- No usar el proyecto remoto desde el repo via `supabase link`.

### 4.2. Exportar dump desde produccion sin enlazar el repo

Preparar directorio temporal:

```bash
export CLONE_DIR="$HOME/tmp/babyclub-clones/$(date +%Y%m%d-%H%M%S)"
mkdir -p "$CLONE_DIR"
chmod 700 "$CLONE_DIR"
```

Export recomendado por defecto: schema y data de `public`.

```bash
export PROD_DB_URL='postgresql://USER:PASSWORD@HOST:PORT/postgres'

supabase db dump --db-url "$PROD_DB_URL" --schema public -f "$CLONE_DIR/01-public-schema.sql"
supabase db dump --db-url "$PROD_DB_URL" --data-only --schema public --use-copy -f "$CLONE_DIR/02-public-data.sql"
```

Notas:

- Este es el camino minimo para reconstruir el schema funcional de negocio en local.
- Si se necesita login real de backoffice o metadata de storage, pedir un dump adicional y revisarlo antes de importarlo, porque puede incluir PII o tablas internas que requieren un tratamiento mas fino.

### 4.3. Importar el dump en Supabase local

Primero dejar el local limpio:

```bash
supabase stop
supabase start --exclude vector
supabase status -o env | rg '^[A-Z0-9_]+=' > /tmp/babyclub.supabase.env
source /tmp/babyclub.supabase.env
supabase db reset --local --no-seed
```

Luego importar schema y data:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$CLONE_DIR/01-public-schema.sql"
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$CLONE_DIR/02-public-data.sql"
```

Validacion SQL minima:

```bash
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from public.organizers;"
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from public.events;"
psql "$DB_URL" -v ON_ERROR_STOP=1 -Atc "select count(*) from public.tables;"
```

Si alguno de esos `select` falla por tabla inexistente, el schema no quedo importado y no se debe arrancar las apps todavia.

## 5. Validacion manual del entorno local

### 5.1. Validar Supabase local

- Abrir `http://127.0.0.1:54323` y confirmar que Studio responde.
- Confirmar en SQL editor o via `psql` que existen tablas de negocio en `public`.
- Confirmar que `supabase status -o env` sigue devolviendo `API_URL` y `DB_URL`.

### 5.2. Levantar apps locales

Con los `.env.local` ya apuntando al stack local:

```bash
pnpm install
pnpm dev:landing
pnpm dev:backoffice
```

Puertos esperados:

- `landing` -> `http://localhost:3001`
- `backoffice` -> `http://localhost:3000`

### 5.3. Smoke manual

Checks publicos:

```bash
curl -i http://localhost:3001/api/events
curl -i http://localhost:3001/api/branding
curl -i http://localhost:3001/api/layout
pnpm smoke:local
```

Si ya existe un codigo valido en el dump local:

```bash
CODE='<codigo-real-del-dump>' pnpm smoke:local
```

Checks visuales:

- `http://localhost:3001/registro` carga sin pegarle al proyecto remoto.
- `http://localhost:3000/auth/login` responde.
- Los datos visibles en landing/backoffice corresponden al dump local y no cambian nada en produccion.

Nota:

- Si el clon solo incluyo `public`, el login real del backoffice puede requerir carga adicional de datos de auth. Eso no invalida el clon funcional para APIs publicas y validaciones de lectura.
- Si landing necesita renderizar assets remotos con `next/image`, revisar primero la limitacion actual de `apps/landing/next.config.js`: hoy solo acepta el host de storage de produccion.

## 6. Criterio de salida

El entorno queda listo cuando se cumplen estas condiciones:

- Supabase local corre con `supabase start --exclude vector`.
- `apps/landing/.env.local` y `apps/backoffice/.env.local` no contienen referencias a `.supabase.co` ni al project ref remoto.
- `public.organizers`, `public.events` y `public.tables` existen en la base local.
- `pnpm smoke:local` pasa al menos para `events`, `branding` y `layout`.

## 7. Apagado y limpieza

Cuando termine la sesion:

```bash
supabase stop
```

Eliminar dumps temporales si contenian datos sensibles:

```bash
rm -rf "$CLONE_DIR"
```
