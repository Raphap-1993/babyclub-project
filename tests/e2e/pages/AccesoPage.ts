import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object para la página de Acceso (home)
 * Encapsula locators y acciones del flujo de ingreso con código
 */
export class AccesoPage {
  readonly page: Page;
  
  // Logo y branding
  readonly logo: Locator;
  
  // Form de acceso
  readonly inputCodigo: Locator;
  readonly btnEntrar: Locator;
  
  // Links
  readonly linkComprar: Locator;
  readonly linkReservar: Locator;
  
  // Errores
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    
    this.logo = page.locator('text=BABY');
    this.inputCodigo = page.locator('input[placeholder*="Código"], input[placeholder*="código"]');
    this.btnEntrar = page.locator('button:has-text("ENTRAR")');
    this.linkComprar = page.locator('a:has-text("Comprar tickets")');
    this.linkReservar = page.locator('a:has-text("reservar mesa")');
    this.errorMessage = page.locator('text=/código.*inválido/i, text=/error/i');
  }

  /**
   * Navegar a página de acceso
   */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Ingresar código de acceso
   */
  async ingresarCodigo(codigo: string) {
    await this.inputCodigo.fill(codigo);
    await this.btnEntrar.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verificar que redirige a registro
   */
  async expectRedirectToRegistro() {
    await expect(this.page).toHaveURL(/\/registro/);
  }

  /**
   * Verificar error de código inválido
   */
  async expectCodigoInvalido() {
    await expect(this.errorMessage).toBeVisible();
  }

  /**
   * Ir a compra directa
   */
  async irACompra() {
    await this.linkComprar.click();
    await this.page.waitForLoadState('networkidle');
    await expect(this.page).toHaveURL(/\/compra/);
  }
}
