# Testing E2E - BabyClub Landing

Guía completa para ejecutar y mantener las pruebas end-to-end de la landing de BabyClub.

## 📋 Índice

- [Instalación](#instalación)
- [Ejecución de Tests](#ejecución-de-tests)
- [Estructura del Proyecto](#estructura-del-proyecto)
- [Escribir Nuevos Tests](#escribir-nuevos-tests)
- [Buenas Prácticas](#buenas-prácticas)
- [CI/CD](#cicd)
- [Troubleshooting](#troubleshooting)

## 🚀 Instalación

### 1. Instalar Playwright

```bash
cd /Users/rapha/Projects/babyclub-monorepo
pnpm add -D @playwright/test
pnpm exec playwright install
```

### 2. Instalar navegadores

```bash
pnpm exec playwright install chromium firefox webkit
```

### 3. Verificar instalación

```bash
pnpm exec playwright --version
```

## ▶️ Ejecución de Tests

### Ejecutar todos los tests

```bash
pnpm exec playwright test --config=tests/e2e/playwright.config.ts
```

### Ejecutar tests en modo UI (recomendado para desarrollo)

```bash
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --ui
```

### Ejecutar solo un archivo de tests

```bash
pnpm exec playwright test tests/e2e/specs/registro.spec.ts
```

### Ejecutar en modo headed (ver navegador)

```bash
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --headed
```

### Ejecutar en un navegador específico

```bash
# Solo Chromium
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --project=chromium

# Solo Firefox
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --project=firefox

# Solo WebKit (Safari)
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --project=webkit
```

### Modo debug

```bash
pnpm exec playwright test --config=tests/e2e/playwright.config.ts --debug
```

### Ver reporte HTML

```bash
pnpm exec playwright show-report tests/e2e/playwright-report
```

## 📁 Estructura del Proyecto

```
tests/e2e/
├── playwright.config.ts       # Configuración principal
├── fixtures/
│   └── index.ts              # Fixtures y test data
├── pages/
│   ├── AccesoPage.ts         # Page Object: home
│   ├── RegistroPage.ts       # Page Object: /registro
│   └── CompraPage.ts         # Page Object: /compra
├── helpers/
│   └── index.ts              # Utilidades y helpers
├── specs/
│   ├── acceso.spec.ts        # Tests de acceso
│   ├── registro.spec.ts      # Tests de registro
│   └── compra.spec.ts        # Tests de compra
└── playwright-report/        # Reportes generados
```

## ✍️ Escribir Nuevos Tests

### Ejemplo básico usando fixtures

```typescript
import { test, expect } from '../fixtures';

test.describe('Mi nueva funcionalidad', () => {
  test('debe hacer algo', async ({ registroPage, testData }) => {
    await registroPage.goto(testData.validCode);
    
    // Tus assertions aquí
    await expect(registroPage.btnGenerarQR).toBeVisible();
  });
});
```

### Usar helpers en tests

```typescript
import { test, expect } from '../fixtures';
import { createHelpers, TestDataGenerator } from '../helpers';

test('test con helpers', async ({ page }) => {
  const helpers = createHelpers(page);
  
  // Generar datos de prueba
  const email = TestDataGenerator.randomEmail();
  const dni = TestDataGenerator.randomDNI();
  
  // Esperar API call
  await helpers.network.waitForApiCall('/api/tickets');
  
  // Tomar screenshot
  await helpers.screenshot.takeScreenshot('mi-test');
});
```

### Page Object pattern

```typescript
// En pages/MiPage.ts
export class MiPage {
  readonly page: Page;
  readonly miBoton: Locator;
  
  constructor(page: Page) {
    this.page = page;
    this.miBoton = page.locator('button:has-text("Click")');
  }
  
  async goto() {
    await this.page.goto('/mi-ruta');
  }
  
  async hacerAccion() {
    await this.miBoton.click();
  }
}
```

## ✅ Buenas Prácticas

### 1. Independencia de tests

Cada test debe poder ejecutarse de forma aislada:

```typescript
test.beforeEach(async ({ page }) => {
  // Setup limpio
  await page.goto('/');
});

test.afterEach(async ({ page }) => {
  // Cleanup si es necesario
  await page.close();
});
```

### 2. Esperas explícitas

Preferir `waitFor` sobre `waitForTimeout`:

```typescript
// ❌ Evitar
await page.waitForTimeout(5000);

// ✅ Mejor
await page.waitForSelector('button');
await page.waitForLoadState('networkidle');
```

### 3. Locators robustos

Usar locators que no dependan de implementación:

```typescript
// ❌ Evitar (frágil)
page.locator('.css-1234-abc');

// ✅ Mejor (semántico)
page.locator('button:has-text("Guardar")');
page.locator('[data-testid="submit-button"]');
page.locator('role=button[name="Guardar"]');
```

### 4. Assertions claras

```typescript
// ✅ Específico y claro
await expect(page.locator('h1')).toHaveText('Bienvenido');
await expect(page).toHaveURL(/\/registro/);
await expect(errorMessage).toContainText('inválido');
```

### 5. Datos de prueba

Usar el `TestDataGenerator` para evitar colisiones:

```typescript
const formData = {
  email: TestDataGenerator.randomEmail('registro'),
  dni: TestDataGenerator.randomDNI(),
  nombre: TestDataGenerator.randomName(),
};
```

### 6. Agrupar tests relacionados

```typescript
test.describe('Flujo de pago', () => {
  test.describe('Con Yape', () => {
    // Tests específicos de Yape
  });
  
  test.describe('Con tarjeta', () => {
    // Tests específicos de tarjeta
  });
});
```

## 🔄 CI/CD

### GitHub Actions

Crear `.github/workflows/e2e.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      
      - name: Run E2E tests
        run: pnpm exec playwright test --config=tests/e2e/playwright.config.ts
        env:
          CI: true
          LANDING_URL: http://localhost:3001
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: tests/e2e/playwright-report/
```

### Variables de entorno en CI

```bash
# En CI, configurar estas variables
LANDING_URL=https://staging.baby.club
NEXT_PUBLIC_DEFAULT_CODE=TESTCODE
```

## 🐛 Troubleshooting

### Tests fallan localmente pero pasan en CI

1. Verificar que tienes las mismas versiones de navegadores:
   ```bash
   pnpm exec playwright install --force
   ```

2. Limpiar estado del navegador:
   ```bash
   rm -rf ~/.cache/ms-playwright
   pnpm exec playwright install
   ```

### Timeouts frecuentes

Aumentar timeout global en `playwright.config.ts`:

```typescript
export default defineConfig({
  timeout: 60_000, // 60 segundos
  expect: {
    timeout: 10_000, // 10 segundos
  },
});
```

### Tests flaky (intermitentes)

1. Agregar esperas más robustas:
   ```typescript
   await page.waitForLoadState('networkidle');
   await expect(element).toBeVisible({ timeout: 10_000 });
   ```

2. Deshabilitar animaciones CSS:
   ```typescript
   test.use({
     extraHTTPHeaders: {
       'Prefers-Reduced-Motion': 'reduce'
     }
   });
   ```

### Error "Element is not visible"

```typescript
// Asegurar que elemento está en viewport
await page.locator('button').scrollIntoViewIfNeeded();
await page.locator('button').click();
```

### Debugging

```bash
# Modo debug con pausa
PWDEBUG=1 pnpm exec playwright test

# Ver trace de test fallido
pnpm exec playwright show-trace tests/e2e/test-results/trace.zip
```

## 📊 Métricas de Calidad

### Cobertura objetivo

- ✅ **Flujos críticos**: 100% (registro, compra, pago)
- ✅ **Flujos secundarios**: 80% (navegación, filtros)
- ✅ **Edge cases**: 60% (errores, validaciones)

### Criterios de aceptación

- Tests pasan en los 3 navegadores principales (Chromium, Firefox, WebKit)
- Tiempo de ejecución < 5 minutos
- Sin tests flaky (>95% de estabilidad)
- Screenshots/traces capturados en fallos

## 🔗 Scripts útiles en package.json

Agregar a `package.json` del monorepo:

```json
{
  "scripts": {
    "test:e2e": "playwright test --config=tests/e2e/playwright.config.ts",
    "test:e2e:ui": "playwright test --config=tests/e2e/playwright.config.ts --ui",
    "test:e2e:headed": "playwright test --config=tests/e2e/playwright.config.ts --headed",
    "test:e2e:debug": "playwright test --config=tests/e2e/playwright.config.ts --debug",
    "test:e2e:report": "playwright show-report tests/e2e/playwright-report",
    "test:e2e:codegen": "playwright codegen localhost:3001"
  }
}
```

## 📚 Recursos adicionales

- [Playwright Docs](https://playwright.dev/docs/intro)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [Page Object Model](https://playwright.dev/docs/pom)

## 🤝 Contribuir

Al agregar nuevos tests:

1. Seguir el patrón Page Object
2. Usar fixtures para test data
3. Agregar comentarios descriptivos
4. Verificar que pasan en los 3 navegadores
5. Documentar edge cases

---

**Última actualización**: 2026-02-09
**Mantenedor**: Equipo Técnico BabyClub
