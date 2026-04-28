# BabyClub Monorepo

Monorepo de BabyClub para:

- landing publica (`apps/landing`)
- backoffice administrativo (`apps/backoffice`)
- utilidades compartidas (`packages/shared`)
- base de datos Supabase (`supabase/`)

## Estado actual (2026-02)

- Deploy: Vercel
- DB/Auth/Storage: Supabase
- Flujo de pagos online (Culqi): **pendiente de habilitacion** por accesos/API
- Release operativo actual: flujo sin modulo de pagos online

## Apps

- `apps/landing`: web publica (registro, tickets, reservas, APIs publicas)
- `apps/backoffice`: panel interno (eventos, codigos, scan, reservas, usuarios)
- `apps/api`: servicio auxiliar legacy

## Requisitos

- Node >= 18
- pnpm 9

## Instalar y correr

```bash
pnpm install
pnpm dev
```

Desarrollo por app:

```bash
pnpm dev:landing
pnpm dev:backoffice
pnpm dev:api
```

Topologia local actual:

- `backoffice` -> `http://localhost:3000`
- `landing` -> `http://localhost:3001`
- `api` legacy -> `http://localhost:4000`

## Scripts principales

```bash
pnpm test
pnpm lint
pnpm build
pnpm dev:api
pnpm typecheck:landing
pnpm smoke:local
pnpm db:check:backoffice
```

## Variables de entorno clave

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENABLE_CULQI_PAYMENTS` (`true|false`)

Para el release actual sin pagos online:

```bash
ENABLE_CULQI_PAYMENTS=false
```

## Lanzamiento de evento (sin pagos online)

Checklist operativo:

- `docs/EVENT-LAUNCH-CHECKLIST-2026-02.md`
- Setup local completo:
  - `docs/LOCAL-SETUP-2026-02.md`

Smoke de APIs publicas:

```bash
bash scripts/smoke-public-api.sh "https://babyclubaccess.com" "CODIGO_DE_PRUEBA"
```

## Documentacion de arquitectura

- `docs/ARCHITECTURE_V2.md`
- `docs/AUDIT-2026-02.md`
- `docs/ARCHITECTURE_V2.md`
- `docs/STRANGLER_PLAN.md`
- `docs/CULQI-INTEGRATION-2026-02.md`
- `docs/DB-GOVERNANCE-2026-02.md`
- `docs/HITOS-2026-02.md`
- `docs/adr/`

## Requerimientos en Obsidian

- La vault operativa real vive en `/Users/rapha/Documents/Obsidian Vault/20_Projects/babyclub-monorepo`.
- El mirror tecnico del repo vive en `docs/pm-vault/`.
- Dentro de la vault real, el mirror repo-side queda visible como `20_Projects/babyclub-monorepo/90 Repo Mirror`.
- Punto de entrada repo-side: `docs/pm-vault/00-Home.md`
- Fuente formal de decisiones aprobadas: `docs/adr/`
