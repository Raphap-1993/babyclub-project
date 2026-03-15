# CLAUDE.md — BabyClub Monorepo

Reglas de colaboración para este monorepo de ticketing/eventos. Léelas antes de cualquier tarea.

---

## 1. Arquitectura en una línea

**Turborepo · 2× Next.js 16 App Router · Supabase (PostgreSQL + Auth + Storage) · Tailwind v3 · pnpm workspaces · Deploy en Vercel**

---

## 2. Mapa mental del proyecto

```
apps/
  landing/           → Web pública: registro, tickets, reservas, mapas de mesas
  backoffice/        → Admin: gestión, scanner, reportes, staff, códigos
  api/               → Servicio legacy Node.js (solo uploads de archivos)

packages/
  ui/                → Design system: ~21 componentes Radix/shadcn
  shared/            → Lógica de negocio compartida: auth, pagos, email, fechas
  api-logic/         → Agregaciones: qr-summary, promoter-summary
  eslint-config/     → Presets ESLint para apps y packages
  typescript-config/ → Presets tsconfig base

supabase/
  migrations/        → 46+ migraciones SQL (NO usa Prisma ORM)

scripts/             → Auditoría, smoke tests, migraciones manuales
docs/                → 93+ docs de arquitectura, ADRs, changelogs
```

---

## 3. Dominios y archivos clave

| Dominio | App | Archivos clave |
|---------|-----|----------------|
| Registro público | landing | `app/registro/`, `app/api/tickets/`, `app/api/reniec/` |
| Tickets | landing + backoffice | `app/api/tickets/`, `app/admin/tickets/` |
| Reservas de mesas | landing + backoffice | `app/api/reservations/`, `app/admin/reservations/`, `app/api/tables/` |
| Mapa/croquis de mesas | landing | `app/api/layout/`, `lib/imageOptimization.ts` |
| Códigos promo | landing + backoffice | `app/api/codes/`, `app/admin/codes/` |
| Aforo/capacidad | landing | `app/api/aforo/`, `packages/shared/entryLimit.ts` |
| Pagos | landing | `app/api/payments/`, `packages/shared/payments/culqi.ts`, `lib/payment-config.ts` |
| Auth/Seguridad staff | backoffice | `app/auth/login/`, `lib/supabaseClient.ts`, `packages/shared/auth/` |
| Roles y permisos | backoffice | `lib/roles.ts`, `packages/shared/auth/roles.ts` |
| Scanner QR | backoffice | `app/admin/scan/` |
| Reportes | backoffice | `app/admin/reportes/`, `app/admin/ingresos/`, `packages/api-logic/` |
| Promotores | landing + backoffice | `app/api/promoters/`, `app/admin/promoters/` |
| Branding | landing + backoffice | `app/api/branding/`, `app/admin/branding/`, `lib/branding.ts` |
| Email | shared | `packages/shared/email/resend.ts` |
| Rate limiting | shared | `packages/shared/security/rateLimit.ts` |
| DB helpers | shared | `packages/shared/db/softDelete.ts` |
| Design system | packages/ui | `packages/ui/src/components/`, `packages/ui/src/hooks/` |
| Fechas Lima | shared | `packages/shared/limaTime.ts`, `packages/shared/datetime.ts` |

---

## 4. Reglas de código (no negociables)

### Base de datos

- **No usar Prisma.** La DB es Supabase PostgreSQL con migraciones SQL en `supabase/migrations/`.
- **Acceder a Supabase siempre via el cliente correspondiente:**
  - Landing: crear cliente con `supabase/ssr` o `@supabase/supabase-js` según sea server/client
  - Backoffice: `lib/supabaseClient.ts` (singleton)
- **Toda escritura que marque como eliminado usa soft delete:** `packages/shared/db/softDelete.ts`
- **Multi-tenant:** filtrar siempre por `organizer_id` en queries que lo requieran.

### Auth y roles

- **No usar next-auth ni Clerk.** Auth es Supabase + lógica custom en `packages/shared/auth/`.
- **Rutas admin protegidas:** llamar `requireStaff()` desde `packages/shared/auth/requireStaff.ts` al inicio de cada handler.
- **Roles válidos:** `admin`, `puerta`, `promotor`, `moso`, `cajero` — definidos en `packages/shared/auth/roles.ts`.

### Componentes

- Server Components por defecto. `"use client"` solo con interactividad real.
- Backoffice usa React Hook Form + Zod para formularios.
- Landing usa `useState` + `fetch` directo (sin RHF, salvo en componentes complejos).
- Componentes UI desde `@repo/ui`. No instalar librerías de componentes nuevas sin consultar.

### Rutas API

- Validar inputs con Zod antes de tocar la DB.
- Errores: `NextResponse.json({ error: "..." }, { status: N })`.
- Rate limiting en rutas públicas críticas: usar `packages/shared/security/rateLimit.ts`.
- Rutas de backoffice deben autenticar con `requireStaff()` al inicio.

### Estilos

- Tailwind v3.4 con `clsx` + `tailwind-merge`.
- No `style={{}}` inline salvo valores dinámicos imposibles en Tailwind.
- Tema: CSS variables definidas en `packages/ui/src/theme.ts`.

### Código compartido

- Lógica de negocio que usan ambas apps → `packages/shared/`.
- Componentes visuales reutilizables → `packages/ui/src/`.
- Agregaciones de datos complejas → `packages/api-logic/`.
- No duplicar lógica entre `apps/landing` y `apps/backoffice`.

### Pagos

- Gateway primario: Culqi (`packages/shared/payments/culqi.ts`).
- Izipay: integrado pero como placeholder, verificar `lib/payment-config.ts` antes de tocar.
- Flujo de pago manual (reservación sin pago online): siempre preservar como fallback.

### Fechas

- **Toda fecha se maneja en zona Lima (America/Lima, UTC-5).**
- Usar `packages/shared/limaTime.ts` para conversiones de timezone.
- No usar `new Date()` crudo en lógica de negocio — pasar por los helpers de datetime.

---

## 5. Stack de Agentes IA

### Capa 1 — Arquitectura y Decisiones

#### `/orchestrate` ← **SIEMPRE PRIMERO**
Arquitecto principal y orquestador. Revisa todo pedido no trivial antes de ejecutar.
Produce ADRs, divide iniciativas en fases, delega a agentes especializados.
Skill: `.claude/commands/orchestrate.md`

---

### Capa 2 — Implementación Especializada

#### `/debug`
**Cuándo:** Errores en runtime, queries Supabase fallando, problemas de auth/roles, rate limits inesperados.
Skill: `.claude/commands/debug.md`

```
Tarea para /debug:
- App: landing | backoffice
- Archivo: [ruta exacta]
- Error exacto: [stack trace completo]
- Contexto: [qué acción lo dispara, dev/prod]
- Datos de entrada: [JSON o descripción]
```

#### `/refactor`
**Cuándo:** Duplicación entre apps, componentes muy largos, extraer a packages/shared.
Skill: `.claude/commands/refactor.md`

```
Tarea para /refactor:
- Archivo: [ruta exacta]
- Problema: [qué está duplicado o mal]
- Restricción: no cambiar API pública del módulo
- Resultado esperado: mismo comportamiento, código más limpio
```

#### `/database`
**Cuándo:** Nueva migración Supabase, nueva query, índice faltante, cambio de schema.
Skill: `.claude/commands/database.md`

```
Tarea para /database:
- Tabla afectada: [nombre]
- Cambio: [describir]
- Nueva migración: supabase/migrations/[timestamp]_[nombre].sql
- Multi-tenant: ¿requiere filtro organizer_id? [sí/no]
```

#### `/performance`
**Cuándo:** LCP lento en landing, queries N+1 Supabase, imágenes sin optimizar, bundle grande.
Skill: `.claude/commands/performance.md`

```
Tarea para /performance:
- Página/componente: [ruta exacta]
- Métrica actual: [LCP, TTI, bundle size, tiempo de query]
- Restricción: mantener RSC donde sea posible
```

#### `/shared`
**Cuándo:** Añadir nuevo módulo a `packages/shared` o `packages/api-logic` que usen ambas apps.
Skill: `.claude/commands/shared.md`

```
Tarea para /shared:
- Nuevo módulo: packages/shared/[nombre].ts
- Lógica: [describir qué hace]
- Tests: packages/shared/[nombre].test.ts
- Exportar en: packages/shared/package.json
```

---

### Capa 3 — UI/UX

#### `/ux`
**Cuándo:** Auditar UI pública (landing) o admin (backoffice), accesibilidad, conversión.
Skill: `.claude/commands/ux.md`

```
Tarea para /ux:
- Componente: [ruta exacta]
- Modo: audit | fix | review
- Foco: accesibilidad | conversión | mobile | consistencia | todo
- No tocar: [qué preservar]
```

---

### Capa 4 — Conocimiento y Documentación

#### `/docs`
**Cuándo:** Documentar cambio completado, escribir ADR, actualizar arquitectura, changelog.
Skill: `.claude/commands/docs.md`

```
Tarea para /docs:
- Modo: adr | changelog | flow | runbook | update
- Cambio a documentar: [descripción]
- Archivos afectados: [lista]
- Guardar en: docs/[carpeta]/[nombre].md
```

#### `/diagrams`
**Cuándo:** Visualizar arquitectura, flujo de negocio, schema DB, secuencia de sistemas.
Skill: `.claude/commands/diagrams.md`

```
Tarea para /diagrams:
- Tipo: flow | architecture | schema | sequence
- Qué diagramar: [descripción]
- Guardar en: docs/[carpeta]/[nombre].md
```

---

## 6. Comandos útiles

```bash
# Desarrollo
pnpm dev                    # Ambas apps en paralelo
pnpm dev:landing            # Solo landing (puerto 3000)
pnpm dev:backoffice         # Solo backoffice (puerto 3001)

# Calidad antes de commit
pnpm lint                   # ESLint (0 warnings)
pnpm test                   # Vitest (node env)
pnpm typecheck:landing      # TypeScript check landing
pnpm typecheck:backoffice   # TypeScript check backoffice

# Base de datos
pnpm db:check:landing       # Verifica config DB landing
pnpm db:check:backoffice    # Verifica config DB backoffice

# Migraciones Supabase (manual SQL)
# Crear archivo en supabase/migrations/[timestamp]_[nombre].sql
# Aplicar via Supabase CLI o dashboard

# Smoke tests
pnpm smoke:local            # Smoke test APIs locales
bash scripts/smoke-public-api.sh [URL] [CODE]

# Auditorías
pnpm audit:event-capacity   # Capacidad y aforo
node scripts/audit-codes.js # Auditoría de códigos
node scripts/audit-promoter-metrics.js

# Build
pnpm build                  # Turbo: build todas las apps/packages
```

---

## 7. Patrones establecidos

### Supabase query (server-side)

```typescript
// Siempre filtrar por organizer_id en tablas multi-tenant
const { data, error } = await supabase
  .from("events")
  .select("*")
  .eq("organizer_id", organizerId)
  .eq("is_active", true);

if (error) {
  return NextResponse.json({ error: error.message }, { status: 500 });
}
```

### API route con auth (backoffice)

```typescript
import { requireStaff } from "@repo/shared/auth/requireStaff";

export async function GET(req: Request) {
  const staff = await requireStaff(req); // Primero siempre
  // ... lógica
}
```

### Zod validation

```typescript
const result = Schema.safeParse(await req.json());
if (!result.success) {
  return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
}
const data = result.data;
```

### Rate limiting

```typescript
import { rateLimit } from "@repo/shared/security/rateLimit";

const allowed = await rateLimit(ip, "tickets", limit);
if (!allowed) {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}
```

### Fecha en Lima

```typescript
import { getLimaTime, toLimaISO } from "@repo/shared/limaTime";

const now = getLimaTime();          // Date en zona Lima
const iso = toLimaISO(someDate);    // ISO string con offset -05:00
```

### Componente UI compartido

```typescript
// Importar siempre desde @repo/ui
import { Button } from "@repo/ui/button";
import { DataTable } from "@repo/ui/data-table";
```

---

## 8. Lo que NO se hace en este proyecto

- No se usa Prisma. Solo SQL nativo en migraciones Supabase.
- No se usa next-auth, Clerk ni auth externo. Auth es Supabase + `packages/shared/auth/`.
- No se usa Redux, Zustand ni Context global. Estado local con `useState` + fetch.
- No se duplica lógica entre `apps/landing` y `apps/backoffice`. Va a `packages/shared/`.
- No se instalan librerías de componentes nuevas sin consultar. Usar `@repo/ui` primero.
- No se hardcodean fechas sin pasar por los helpers de Lima time.
- No se asume una sola zona horaria: siempre America/Lima explícitamente.
- No se expone `service_role_key` de Supabase en código client-side.

---

## 9. Variables de entorno clave

```
# Supabase (ambas apps)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY      # Solo server-side, nunca exponer al cliente
SUPABASE_ANON_KEY
NEXT_PUBLIC_SUPABASE_URL       # Backoffice
NEXT_PUBLIC_SUPABASE_ANON_KEY  # Backoffice

# Multi-tenant
NEXT_PUBLIC_ORGANIZER_ID       # ID del organizador activo

# Pagos
PAYMENT_METHOD                 # reservation | izipay | culqi
CULQI_SECRET_KEY               # Server-side only

# Email
RESEND_API_KEY
RESEND_FROM

# Rate limits (req/min)
RATE_LIMIT_PERSONS_PER_MIN
RATE_LIMIT_RENIEC_PER_MIN
RATE_LIMIT_SCAN_PER_MIN
```

---

## 10. Checklist pre-commit

```
[ ] pnpm lint pasa con 0 warnings
[ ] pnpm test pasa
[ ] Si hay cambio de schema: nueva migración en supabase/migrations/
[ ] Si hay nueva lógica compartida: va en packages/shared/, no duplicada en apps/
[ ] Multi-tenant: queries nuevas filtran por organizer_id donde aplica
[ ] No hay service_role_key expuesta en código client-side
[ ] No hay console.log de debug
[ ] Fechas: usando limaTime helpers, no new Date() crudo
[ ] Rutas backoffice nuevas: protegidas con requireStaff()
```

---

## 11. Modo de respuesta de Claude

```
- PRIMERO: ante cualquier pedido no trivial, invocar /orchestrate antes de tocar código
- Priorizar soluciones pragmáticas sobre arquitectura ideal
- No proponer librerías nuevas salvo que sea crítico
- Si detectas deuda técnica grave, señalarla claramente
- Si el cambio afecta landing Y backoffice, evaluar si va a packages/shared/
- Si falta contexto, pedir SOLO lo mínimo necesario
- No Prisma, no next-auth, no estado global — recordar siempre
```

## Autonomía permitida

```
Claude puede:
- refactorizar internals de componentes
- extraer lógica a packages/shared
- optimizar queries Supabase
- añadir tests en packages/shared/*.test.ts

Claude NO puede:
- cambiar el sistema de auth (Supabase + requireStaff)
- modificar turbo.json sin consultar
- cambiar estructura de migraciones Supabase
- mover apps entre puertos sin consultar
```

## Hotspots del monorepo

```
- packages/shared/auth/requireStaff.ts → crítico, no tocar sin pruebas
- packages/shared/security/rateLimit.ts → crítico, afecta todas las APIs públicas
- apps/landing/app/api/tickets/ → flujo principal de registro
- apps/backoffice/lib/supabaseClient.ts → shared infra
- supabase/migrations/ → cambios sensibles, irreversibles en prod
```

---

## 12. Workflow de orquestación

**`/orchestrate` es el agente orquestador principal. Es el primero en revisar cualquier pedido.**

Ante cualquier tarea que no sea trivial, Claude DEBE invocar `/orchestrate` antes de tocar código.

```
/orchestrate [descripción del pedido]
```

Flujo estándar:
1. Usuario envía un pedido → Claude invoca `/orchestrate` primero
2. Orquestador: análisis → plan → prompts de delegación
3. Usuario: aprueba o ajusta
4. Ejecución fase por fase, con agentes especializados si corresponde

Cuándo NO es necesario `/orchestrate` (implementar directo):
- Fixes de una línea o bugs con stack trace claro y alcance 100% obvio
- Copy o texto simple (un label, un typo)
- Nueva query Supabase trivial y aislada → `@database` directamente

En caso de duda: usar `/orchestrate`. El costo de orquestar de más es bajo; el de ejecutar sin plan es alto.
