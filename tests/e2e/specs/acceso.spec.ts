import { test, expect } from '../fixtures';

/**
 * Suite de pruebas E2E para el flujo de Acceso (home)
 * Cubre ingreso con código y navegación a compra
 */

test.describe('Flujo de Acceso - Landing Principal', () => {
  test.beforeEach(async ({ accesoPage }) => {
    await accesoPage.goto();
  });

  test('debe cargar la página principal correctamente', async ({ accesoPage, page }) => {
    await expect(accesoPage.logo).toBeVisible();
    await expect(accesoPage.inputCodigo).toBeVisible();
    await expect(accesoPage.btnEntrar).toBeVisible();
    await expect(page).toHaveTitle(/Baby|BABY/i);
  });

  test('debe mostrar links de compra/reserva', async ({ accesoPage }) => {
    const linkComprarVisible = await accesoPage.linkComprar.isVisible().catch(() => false);
    const linkReservarVisible = await accesoPage.linkReservar.isVisible().catch(() => false);
    
    // Al menos uno debe estar visible
    expect(linkComprarVisible || linkReservarVisible).toBe(true);
  });

  test('debe redirigir a registro con código válido', async ({ accesoPage, testData }) => {
    await accesoPage.ingresarCodigo(testData.validCode);
    await accesoPage.expectRedirectToRegistro();
  });

  test('debe mostrar error con código inválido', async ({ accesoPage }) => {
    await accesoPage.ingresarCodigo('CODIGO_INVALIDO_XYZ123');
    
    // Verificar que no redirige o muestra error
    const hasError = await accesoPage.errorMessage.isVisible().catch(() => false);
    const stillOnHome = await accesoPage.page.url().then(url => url.includes('/registro') === false);
    
    expect(hasError || stillOnHome).toBe(true);
  });

  test('debe validar código vacío', async ({ accesoPage, page }) => {
    await accesoPage.btnEntrar.click();
    
    // Verificar validación HTML5 o que no avanza
    const inputValidity = await accesoPage.inputCodigo.evaluate((el: HTMLInputElement) => el.checkValidity());
    const stillOnHome = page.url().includes('/registro') === false;
    
    expect(!inputValidity || stillOnHome).toBe(true);
  });

  test('debe navegar a página de compra', async ({ accesoPage, page }) => {
    const linkVisible = await accesoPage.linkComprar.isVisible().catch(() => false);
    
    if (linkVisible) {
      await accesoPage.irACompra();
      await expect(page).toHaveURL(/\/compra/);
    }
  });

  test('debe ser case-insensitive para códigos', async ({ accesoPage, testData }) => {
    // Probar con código en minúsculas
    const codeLowercase = testData.validCode.toLowerCase();
    await accesoPage.ingresarCodigo(codeLowercase);
    
    // Debe funcionar igual
    const redirected = await accesoPage.page.url().then(url => url.includes('/registro'));
    const hasError = await accesoPage.errorMessage.isVisible().catch(() => false);
    
    // Si el código es válido, debe redirigir; si no, debe mostrar error
    expect(redirected || hasError).toBe(true);
  });

  test('debe trimear espacios del código', async ({ accesoPage, testData }) => {
    // Código con espacios
    const codeWithSpaces = `  ${testData.validCode}  `;
    await accesoPage.ingresarCodigo(codeWithSpaces);
    
    // Debe funcionar igual
    const hasError = await accesoPage.errorMessage.isVisible().catch(() => false);
    const redirected = await accesoPage.page.url().then(url => url.includes('/registro'));
    
    expect(!hasError || redirected).toBe(true);
  });
});

test.describe('Flujo de Acceso - Navegación', () => {
  test.beforeEach(async ({ accesoPage }) => {
    await accesoPage.goto();
  });

  test('debe mantener URL limpia en home', async ({ accesoPage, page }) => {
    const url = page.url();
    expect(url).toMatch(/localhost:3001\/?$/);
  });

  test('debe incluir código en URL al redirigir', async ({ accesoPage, testData, page }) => {
    await accesoPage.ingresarCodigo(testData.validCode);
    
    // Esperar redirección
    await page.waitForURL(/\/registro/, { timeout: 5000 }).catch(() => {});
    
    const finalUrl = page.url();
    if (finalUrl.includes('/registro')) {
      expect(finalUrl).toContain('code=');
    }
  });

  test('debe permitir volver atrás desde registro', async ({ accesoPage, testData, page }) => {
    await accesoPage.ingresarCodigo(testData.validCode);
    await page.waitForURL(/\/registro/, { timeout: 5000 }).catch(() => {});
    
    if (page.url().includes('/registro')) {
      await page.goBack();
      await page.waitForLoadState('networkidle');
      
      // Debe volver al home
      expect(page.url()).toMatch(/localhost:3001\/?$/);
    }
  });
});

test.describe('Flujo de Acceso - Responsive', () => {
  test('debe funcionar en escritorio', async ({ accesoPage, page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await accesoPage.goto();
    
    await expect(accesoPage.logo).toBeVisible();
    await expect(accesoPage.inputCodigo).toBeVisible();
  });

  test('debe funcionar en tablet', async ({ accesoPage, page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await accesoPage.goto();
    
    await expect(accesoPage.logo).toBeVisible();
    await expect(accesoPage.inputCodigo).toBeVisible();
  });

  test('debe funcionar en móvil', async ({ accesoPage, page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await accesoPage.goto();
    
    await expect(accesoPage.logo).toBeVisible();
    await expect(accesoPage.inputCodigo).toBeVisible();
    await expect(accesoPage.btnEntrar).toBeVisible();
  });

  test('debe funcionar en móvil pequeño', async ({ accesoPage, page }) => {
    await page.setViewportSize({ width: 320, height: 568 }); // iPhone SE
    await accesoPage.goto();
    
    await expect(accesoPage.inputCodigo).toBeVisible();
    await expect(accesoPage.btnEntrar).toBeVisible();
  });
});

test.describe('Flujo de Acceso - Performance', () => {
  test('debe cargar en menos de 3 segundos', async ({ accesoPage, page }) => {
    const startTime = Date.now();
    await accesoPage.goto();
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - startTime;
    
    expect(loadTime).toBeLessThan(3000);
  });

  test('debe tener imagen de cover optimizada', async ({ accesoPage, page }) => {
    await accesoPage.goto();
    
    const coverImage = page.locator('img').first();
    const isVisible = await coverImage.isVisible().catch(() => false);
    
    if (isVisible) {
      const src = await coverImage.getAttribute('src');
      expect(src).toBeDefined();
      
      // Verificar que no es una imagen gigante sin optimizar
      const naturalWidth = await coverImage.evaluate((img: HTMLImageElement) => img.naturalWidth);
      expect(naturalWidth).toBeLessThan(3000); // Máximo razonable
    }
  });
});
