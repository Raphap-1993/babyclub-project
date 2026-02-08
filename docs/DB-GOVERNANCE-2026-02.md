# DB GOVERNANCE 2026-02

## Respuesta corta sobre Alembic
Para este proyecto actual (**Next.js + Supabase + SQL migrations**), **no recomiendo Alembic ahora**.

Motivo:
- Alembic pertenece al stack Python + SQLAlchemy.
- Tu backend principal hoy es TypeScript/Next, no SQLAlchemy.
- Mezclar dos sistemas de migración (Alembic + SQL de Supabase) aumenta drift y riesgo.

## Decisión recomendada
Usar **un solo source of truth**:
- `supabase/migrations/*.sql` para todo cambio de esquema.

## Regla de operación
- Nunca cambiar tablas directo en dashboard sin crear migración equivalente en repo.
- Si hay hotfix en dashboard, se debe backportear el SQL al repo ese mismo día.
- Cada release debe correr pre-check de esquema.

## Pre-check local (nuevo)
```bash
pnpm db:check:backoffice
pnpm db:check:landing
```

## Error actual detectado
Tu entorno tiene drift de soft-delete:
- falta `deleted_at` en varias tablas (`events`, `tickets`, `codes`, `table_reservations`, etc).

## Fix mínimo para continuar hoy
Aplicar en Supabase SQL Editor, en este orden:
1. `supabase/migrations/2026-01-31-add-soft-delete.sql`
2. `supabase/migrations/2026-02-07-create-brand-and-layout-settings.sql`

Si quieres un solo copy/paste:
- `supabase/manual/2026-02-07-quickfix-soft-delete-and-settings.sql`

Luego validar:
```bash
pnpm db:check:backoffice
```

## Cuando sí considerar Alembic
Solo si decides mover dominio principal a backend Python con SQLAlchemy.
En ese escenario:
- migraciones de schema en Alembic
- Supabase usado como Postgres administrado
- sin migraciones SQL paralelas fuera de Alembic
