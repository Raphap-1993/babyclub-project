# LOCAL SETUP 2026-02

Objetivo: trabajar en local con los cambios actuales y los nuevos requisitos, sin habilitar pagos online.

## 1) Configurar entorno
Copiar variables de ejemplo:

```bash
cp apps/landing/.env.example apps/landing/.env.local
cp apps/backoffice/.env.example apps/backoffice/.env.local
```

Editar ambos `.env.local` con tus llaves reales de Supabase.

Importante:
- mantener `ENABLE_CULQI_PAYMENTS=false` hasta tener acceso/API de Culqi

## 2) Instalar dependencias
```bash
pnpm install
```

## 3) Correr apps en local
Landing:
```bash
pnpm dev:landing
```

Backoffice:
```bash
pnpm dev:backoffice
```

## 4) Validar rápido
Tests:
```bash
pnpm test
```

Typecheck landing:
```bash
pnpm typecheck:landing
```

Smoke API pública local:
```bash
pnpm smoke:local
```

Con código de prueba:
```bash
CODE=ABC123 pnpm smoke:local
```

## 5) Orden recomendado de implementación (sin pagos)
1. Estabilidad de landing y flujo de registro/QR
2. Filtros + paginación en backend (evitar lógica en frontend)
3. Permisos por rol (admin, puerta, promotor, moso, cajero)
4. Reportes base (asistencia por código/promotor, ventas por fecha)
5. Runbook de release/rollback para evento

## 6) Referencias del repo
- `AGENTS.md`
- `docs/AUDIT-2026-02.md`
- `docs/EVENT-LAUNCH-CHECKLIST-2026-02.md`
- `docs/RBAC-MATRIX-2026-02.md`
