# Runbook remoto: hotfix puntual RPC `get_qr_summary_all`

Fecha de preparacion: 2026-05-28

## Objetivo

Aplicar solo el hotfix del dashboard QR en el proyecto remoto `babyclub-access` (`wtwnhqbbcocpnqqsybln`) sin ejecutar `supabase db push --linked`, porque ese branch tiene otras dos migraciones pendientes que no deben tocarse en una ventana con eventos reales activos.

El hotfix deja dos reglas estables en el resumen:

- `table` solo cuando `tickets.table_id` no sea null;
- tickets `sale_origin='ticket'` que por compatibilidad historica quedaron con `codes.type='courtesy'` deben resumirse como `general`.

## Hallazgos previos verificados

- Backup previo tomado por API en [20260528-171753](</Users/rapha/tmp/babyclub-clones/20260528-171753>), con:
  - `wtwnhqbbcocpnqqsybln.public.schema.sql`
  - `wtwnhqbbcocpnqqsybln.public.data.sql`
  - `wtwnhqbbcocpnqqsybln.auth.users.json`
- `supabase migration list` muestra tres migraciones locales ausentes en remoto:
  - `20260527213000`
  - `20260528010000`
  - `20260528173000`
- El remoto actual no expone `public.get_qr_summary_all`; el dashboard hoy sobrevive por fallback legacy en [qr-summary.ts](../packages/api-logic/qr-summary.ts).
- `public.tickets.table_id` si existe en el esquema remoto clonado, por lo que el RPC del hotfix es compatible con el estado real de producción.
- Hallazgo adicional del 2026-05-28: existen `37` codigos con `codes.type='courtesy'` ligados a `table_reservations.sale_origin='ticket'` en `BABY RAVE | ABYSS`. No se reclasifican en la tabla `codes` porque el schema remoto mantiene la restriccion `codes_one_general_per_event`; la correccion segura es solo en la funcion de resumen.

## Artefactos

- Apply: [2026-05-28-hotfix-get_qr_summary_all.sql](../supabase/manual/2026-05-28-hotfix-get_qr_summary_all.sql)
- Rollback: [2026-05-28-hotfix-get_qr_summary_all.rollback.sql](../supabase/manual/2026-05-28-hotfix-get_qr_summary_all.rollback.sql)

## Regla operativa

- No usar `supabase db push --linked`.
- Aplicar el SQL puntual via `supabase db query --linked -f ...`.
- Si cualquier verificacion falla, ejecutar rollback inmediato y dejar el dashboard en fallback legacy.

## Precheck

1. Confirmar que el repo sigue enlazado al proyecto correcto:

```bash
supabase db query --linked "select 'ok' as status, now() at time zone 'utc' as checked_at;"
```

2. Confirmar ausencia o presencia actual del RPC:

```bash
supabase db query --linked -o json "select pg_proc.oid::regprocedure::text as signature from pg_proc join pg_namespace n on n.oid = pg_proc.pronamespace where n.nspname = 'public' and pg_proc.proname = 'get_qr_summary_all';"
```

Resultado esperado en el estado inicial verificado el 2026-05-28: `rows: []`. Si el RPC ya existe por un hotfix previo, este paso debe devolver una fila y aun asi puedes reaplicar `create or replace function`.

## Aplicacion

```bash
supabase db query --linked -f supabase/manual/2026-05-28-hotfix-get_qr_summary_all.sql
```

## Verificacion

1. Confirmar que el RPC existe:

```bash
supabase db query --linked -o json "select pg_proc.oid::regprocedure::text as signature from pg_proc join pg_namespace n on n.oid = pg_proc.pronamespace where n.nspname = 'public' and pg_proc.proname = 'get_qr_summary_all';"
```

Resultado esperado: una fila con `public.get_qr_summary_all(timestamp with time zone)`.

2. Confirmar que la definicion aplicada usa `tickets.table_id` y la regla de compatibilidad `ticket + courtesy => general`:

```bash
supabase db query --linked -o json "select pg_get_functiondef(pg_proc.oid) as ddl from pg_proc join pg_namespace n on n.oid = pg_proc.pronamespace where n.nspname = 'public' and pg_proc.proname = 'get_qr_summary_all';"
```

Buscar dentro del `ddl` las lineas:

```sql
when t.table_id is not null then 'table'
when coalesce(tr.sale_origin, '') = 'ticket'
```

3. Smoke funcional del RPC:

```bash
supabase db query --linked -o table "select * from public.get_qr_summary_all((now() - interval '30 days')::timestamptz) order by date desc limit 10;"
```

El objetivo del smoke no es validar cada total manualmente, sino confirmar:

- el RPC responde sin error;
- devuelve `total_qr` y `by_type`;
- ya no depende de que exista `codes.table_reservation_id` para clasificar `table`;
- y reagrupa como `general` los tickets pagados que el schema viejo obliga a guardar como `courtesy`.

4. Verificacion puntual del evento afectado:

```bash
supabase db query --linked -o table "select case when t.table_id is not null then 'table' when tr.sale_origin = 'ticket' and coalesce(nullif(c.type,''),'desconocido') = 'courtesy' then 'general' else coalesce(nullif(c.type,''),'desconocido') end as type_key, count(*)::int as qty from public.tickets t left join public.codes c on c.id = t.code_id and c.deleted_at is null left join public.table_reservations tr on tr.id = t.table_reservation_id and tr.deleted_at is null where t.deleted_at is null and coalesce(t.is_active,true) and t.event_id = '90c84915-3b1a-402c-b5c3-781b50cdfbdd' and coalesce(c.is_active,true) group by 1 order by 2 desc;"
```

Resultado esperado:

- `general = 198`
- `table = 1`

## Rollback

Si el RPC genera error o un resultado operacionalmente sospechoso:

```bash
supabase db query --linked -f supabase/manual/2026-05-28-hotfix-get_qr_summary_all.rollback.sql
```

Verificar que ya no exista:

```bash
supabase db query --linked -o json "select pg_proc.oid::regprocedure::text as signature from pg_proc join pg_namespace n on n.oid = pg_proc.pronamespace where n.nspname = 'public' and pg_proc.proname = 'get_qr_summary_all';"
```

Resultado esperado tras rollback: `rows: []`.

## Nota posterior

Este hotfix puntual no marca la migracion `20260528173000` como aplicada en el historial remoto. Cuando se abra una ventana de release controlada, habra que reconciliar:

- `20260527213000_ticket_package_units_and_post_purchase_nomination.sql`
- `20260528010000_relax_event_ticket_types_sale_phase.sql`
- `20260528173000_fix_qr_summary_table_classification.sql`

Hasta esa ventana, este runbook es la ruta segura para el dashboard.
