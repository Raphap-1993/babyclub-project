import { Page } from '@playwright/test';

/**
 * Helper para gestionar localStorage en tests
 */
export class StorageHelper {
  constructor(private page: Page) {}

  async setItem(key: string, value: string) {
    await this.page.evaluate(
      ({ key, value }) => localStorage.setItem(key, value),
      { key, value }
    );
  }

  async getItem(key: string): Promise<string | null> {
    return await this.page.evaluate(
      (key) => localStorage.getItem(key),
      key
    );
  }

  async clear() {
    await this.page.evaluate(() => localStorage.clear());
  }

  async removeItem(key: string) {
    await this.page.evaluate(
      (key) => localStorage.removeItem(key),
      key
    );
  }
}

/**
 * Helper para gestionar sessionStorage en tests
 */
export class SessionHelper {
  constructor(private page: Page) {}

  async setItem(key: string, value: string) {
    await this.page.evaluate(
      ({ key, value }) => sessionStorage.setItem(key, value),
      { key, value }
    );
  }

  async getItem(key: string): Promise<string | null> {
    return await this.page.evaluate(
      (key) => sessionStorage.getItem(key),
      key
    );
  }

  async clear() {
    await this.page.evaluate(() => sessionStorage.clear());
  }
}

/**
 * Helper para gestionar cookies en tests
 */
export class CookieHelper {
  constructor(private page: Page) {}

  async setCookie(name: string, value: string, options?: {
    domain?: string;
    path?: string;
    expires?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
  }) {
    await this.page.context().addCookies([{
      name,
      value,
      domain: options?.domain || 'localhost',
      path: options?.path || '/',
      expires: options?.expires,
      httpOnly: options?.httpOnly,
      secure: options?.secure,
      sameSite: options?.sameSite,
    }]);
  }

  async getCookie(name: string) {
    const cookies = await this.page.context().cookies();
    return cookies.find(cookie => cookie.name === name);
  }

  async clearCookies() {
    await this.page.context().clearCookies();
  }
}

/**
 * Helper para esperar condiciones de red
 */
export class NetworkHelper {
  constructor(private page: Page) {}

  /**
   * Esperar a que una llamada API específica complete
   */
  async waitForApiCall(urlPattern: string | RegExp, options?: {
    timeout?: number;
    method?: string;
  }) {
    return await this.page.waitForResponse(
      response => {
        const url = response.url();
        const matchesUrl = typeof urlPattern === 'string' 
          ? url.includes(urlPattern)
          : urlPattern.test(url);
        const matchesMethod = !options?.method || response.request().method() === options.method;
        return matchesUrl && matchesMethod;
      },
      { timeout: options?.timeout || 10000 }
    );
  }

  /**
   * Interceptar y mockear una llamada API
   */
  async mockApiCall(urlPattern: string | RegExp, mockData: any, options?: {
    status?: number;
    contentType?: string;
  }) {
    await this.page.route(urlPattern, route => {
      route.fulfill({
        status: options?.status || 200,
        contentType: options?.contentType || 'application/json',
        body: JSON.stringify(mockData),
      });
    });
  }

  /**
   * Simular error de red
   */
  async simulateNetworkError(urlPattern: string | RegExp) {
    await this.page.route(urlPattern, route => {
      route.abort('failed');
    });
  }

  /**
   * Simular latencia de red
   */
  async simulateLatency(urlPattern: string | RegExp, delayMs: number) {
    await this.page.route(urlPattern, async route => {
      await new Promise(resolve => setTimeout(resolve, delayMs));
      await route.continue();
    });
  }
}

/**
 * Helper para capturas de pantalla con nombre descriptivo
 */
export class ScreenshotHelper {
  constructor(private page: Page) {}

  async takeScreenshot(name: string, options?: {
    fullPage?: boolean;
    path?: string;
  }) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await this.page.screenshot({
      path: options?.path || `screenshots/${filename}`,
      fullPage: options?.fullPage !== false,
    });
  }

  async takeElementScreenshot(selector: string, name: string) {
    const element = this.page.locator(selector);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${name}-${timestamp}.png`;
    
    await element.screenshot({
      path: `screenshots/${filename}`,
    });
  }
}

/**
 * Helper para scroll y visibility
 */
export class ScrollHelper {
  constructor(private page: Page) {}

  async scrollToElement(selector: string) {
    await this.page.locator(selector).scrollIntoViewIfNeeded();
  }

  async scrollToTop() {
    await this.page.evaluate(() => window.scrollTo(0, 0));
  }

  async scrollToBottom() {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  }

  async isInViewport(selector: string): Promise<boolean> {
    return await this.page.locator(selector).isInViewport();
  }
}

/**
 * Helper para formularios
 */
export class FormHelper {
  constructor(private page: Page) {}

  /**
   * Llenar formulario completo desde objeto
   */
  async fillForm(formData: Record<string, string>) {
    for (const [field, value] of Object.entries(formData)) {
      const input = this.page.locator(`[name="${field}"], #${field}`);
      const isVisible = await input.isVisible().catch(() => false);
      
      if (isVisible) {
        await input.fill(value);
      }
    }
  }

  /**
   * Validar errores de formulario
   */
  async getFormErrors(): Promise<string[]> {
    const errors = await this.page.locator('.error, [role="alert"], .text-red-500').allTextContents();
    return errors.filter(e => e.trim() !== '');
  }

  /**
   * Verificar validación HTML5
   */
  async isFormValid(formSelector?: string): Promise<boolean> {
    return await this.page.evaluate((selector) => {
      const form = selector 
        ? document.querySelector(selector) as HTMLFormElement
        : document.querySelector('form') as HTMLFormElement;
      return form ? form.checkValidity() : false;
    }, formSelector);
  }

  /**
   * Resetear formulario
   */
  async resetForm(formSelector?: string) {
    await this.page.evaluate((selector) => {
      const form = selector
        ? document.querySelector(selector) as HTMLFormElement
        : document.querySelector('form') as HTMLFormElement;
      if (form) form.reset();
    }, formSelector);
  }
}

/**
 * Helper para esperas inteligentes
 */
export class WaitHelper {
  constructor(private page: Page) {}

  /**
   * Esperar a que desaparezca el spinner/loader
   */
  async waitForLoadingToFinish() {
    await this.page.waitForSelector(
      '.loading, .spinner, [role="progressbar"]',
      { state: 'hidden', timeout: 10000 }
    ).catch(() => {
      // Si no hay loader, continuar
    });
  }

  /**
   * Esperar idle completo (network + animations)
   */
  async waitForIdle() {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(300); // Esperar animaciones CSS
  }

  /**
   * Esperar a que un texto específico aparezca
   */
  async waitForText(text: string, options?: { timeout?: number }) {
    await this.page.waitForSelector(`text="${text}"`, {
      timeout: options?.timeout || 5000,
    });
  }

  /**
   * Esperar y hacer click con retry
   */
  async clickWithRetry(selector: string, maxAttempts = 3) {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        await this.page.locator(selector).click({ timeout: 5000 });
        return;
      } catch (e) {
        if (i === maxAttempts - 1) throw e;
        await this.page.waitForTimeout(500);
      }
    }
  }
}

/**
 * Helper para generar datos de prueba aleatorios
 */
export class TestDataGenerator {
  /**
   * Generar DNI válido aleatorio
   */
  static randomDNI(): string {
    return String(Math.floor(10000000 + Math.random() * 90000000));
  }

  /**
   * Generar email único
   */
  static randomEmail(prefix = 'test'): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefix}-${timestamp}-${random}@test.baby.club`;
  }

  /**
   * Generar teléfono peruano
   */
  static randomPhone(): string {
    return `+51 9${Math.floor(10000000 + Math.random() * 90000000)}`;
  }

  /**
   * Generar nombre aleatorio
   */
  static randomName(): string {
    const nombres = ['Juan', 'María', 'Carlos', 'Ana', 'Luis', 'Carmen', 'Pedro', 'Rosa'];
    return nombres[Math.floor(Math.random() * nombres.length)];
  }

  /**
   * Generar apellido aleatorio
   */
  static randomApellido(): string {
    const apellidos = ['García', 'Rodríguez', 'López', 'Martínez', 'Pérez', 'González', 'Sánchez', 'Torres'];
    return apellidos[Math.floor(Math.random() * apellidos.length)];
  }

  /**
   * Generar fecha de nacimiento de mayor de edad
   */
  static randomBirthdate(minAge = 18, maxAge = 60): string {
    const today = new Date();
    const age = minAge + Math.floor(Math.random() * (maxAge - minAge));
    const birthYear = today.getFullYear() - age;
    const birthMonth = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const birthDay = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0');
    return `${birthYear}-${birthMonth}-${birthDay}`;
  }
}

/**
 * Crear instancias de helpers para una página
 */
export function createHelpers(page: Page) {
  return {
    storage: new StorageHelper(page),
    session: new SessionHelper(page),
    cookie: new CookieHelper(page),
    network: new NetworkHelper(page),
    screenshot: new ScreenshotHelper(page),
    scroll: new ScrollHelper(page),
    form: new FormHelper(page),
    wait: new WaitHelper(page),
  };
}

export type Helpers = ReturnType<typeof createHelpers>;
