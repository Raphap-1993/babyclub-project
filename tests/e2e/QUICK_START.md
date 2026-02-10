# Quick Start - E2E Testing

## Instalación rápida

```bash
# 1. Instalar Playwright
pnpm add -D @playwright/test

# 2. Instalar navegadores
pnpm exec playwright install

# 3. Ejecutar tests
pnpm test:e2e:ui
```

## Comandos principales

```bash
# Ver tests en modo interactivo (RECOMENDADO)
pnpm test:e2e:ui

# Ejecutar todos los tests
pnpm test:e2e

# Ejecutar en modo headed (ver navegador)
pnpm test:e2e:headed

# Debug de un test específico
pnpm test:e2e:debug

# Ver último reporte
pnpm test:e2e:report

# Generar código de test desde el navegador
pnpm test:e2e:codegen
```

## Estructura de tests

```
tests/e2e/
├── specs/           # Tests organizados por flujo
│   ├── acceso.spec.ts      # Tests del home
│   ├── registro.spec.ts    # Tests de registro con código
│   └── compra.spec.ts      # Tests de compra pública
├── pages/           # Page Objects
├── fixtures/        # Test data y setup
└── helpers/         # Utilidades compartidas
```

## Ejecutar solo un flujo

```bash
# Solo tests de registro
pnpm test:e2e tests/e2e/specs/registro.spec.ts

# Solo tests de compra
pnpm test:e2e tests/e2e/specs/compra.spec.ts

# Solo tests de acceso
pnpm test:e2e tests/e2e/specs/acceso.spec.ts
```

## Variables de entorno

Crear `.env.test` en la raíz:

```env
LANDING_URL=http://localhost:3001
NEXT_PUBLIC_DEFAULT_CODE=LOVEISLOVE
```

## Documentación completa

Ver [README.md](./README.md) para la guía completa.
