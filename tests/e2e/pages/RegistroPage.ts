import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object para la página de Registro (/registro)
 * Encapsula locators y acciones del flujo de registro con código
 */
export class RegistroPage {
  readonly page: Page;
  
  // Hero section
  readonly heroImage: Locator;
  readonly aforoLabel: Locator;
  
  // Tabs
  readonly tabTicket: Locator;
  readonly tabMesa: Locator;
  
  // Formulario principal
  readonly selectDocType: Locator;
  readonly inputDocument: Locator;
  readonly inputNombre: Locator;
  readonly inputApellidos: Locator;
  readonly inputEmail: Locator;
  readonly inputTelefono: Locator;
  readonly inputBirthdate: Locator;
  readonly selectPromoter: Locator;
  readonly btnGenerarQR: Locator;
  readonly btnReservarMesa: Locator;
  
  // Formulario de mesa
  readonly selectTable: Locator;
  readonly selectProduct: Locator;
  readonly inputReservaNombre: Locator;
  readonly inputReservaApellidoPaterno: Locator;
  readonly inputReservaApellidoMaterno: Locator;
  readonly inputReservaEmail: Locator;
  readonly inputReservaTelefono: Locator;
  readonly inputVoucher: Locator;
  readonly btnRevisarPago: Locator;
  
  // Modal de pago
  readonly modalPago: Locator;
  readonly yapeNumberText: Locator;
  readonly btnCopyYape: Locator;
  readonly btnConfirmarPago: Locator;
  readonly btnCancelarPago: Locator;
  
  // Modal de confirmación
  readonly modalConfirmacion: Locator;
  readonly successMessage: Locator;
  readonly qrCodes: Locator;
  
  // Errores
  readonly errorMessage: Locator;
  readonly dniError: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Hero
    this.heroImage = page.locator('img[alt*="cover"], img[alt*="Cover"]').first();
    this.aforoLabel = page.locator('text=/AFORO\\s+\\d+%/i');
    
    // Tabs
    this.tabTicket = page.locator('button:has-text("Solo entrada")');
    this.tabMesa = page.locator('button:has-text("Reserva mesa")');
    
    // Form principal
    this.selectDocType = page.locator('select').first();
    this.inputDocument = page.locator('input[placeholder*="documento"], input[type="text"]').first();
    this.inputNombre = page.locator('input[placeholder*="Nombre"]');
    this.inputApellidos = page.locator('input[placeholder*="Apellido"]').first();
    this.inputEmail = page.locator('input[type="email"]').first();
    this.inputTelefono = page.locator('input[placeholder*="Teléfono"], input[placeholder*="teléfono"]').first();
    this.inputBirthdate = page.locator('input[type="date"]').first();
    this.selectPromoter = page.locator('select:has-text("promotor"), select:has-text("Promotor")');
    this.btnGenerarQR = page.locator('button:has-text("GENERAR QR")');
    this.btnReservarMesa = page.locator('button:has-text("RESERVAR MESA")');
    
    // Form mesa
    this.selectTable = page.locator('button[role="button"]:has-text("Box"), button[role="button"]:has-text("Mesa")').first();
    this.selectProduct = page.locator('button[role="button"]:has-text("Pack")').first();
    this.inputReservaNombre = page.locator('input[placeholder*="Nombre"]').nth(1);
    this.inputReservaApellidoPaterno = page.locator('input[placeholder*="Apellido paterno"]');
    this.inputReservaApellidoMaterno = page.locator('input[placeholder*="Apellido materno"]');
    this.inputReservaEmail = page.locator('input[type="email"]').nth(1);
    this.inputReservaTelefono = page.locator('input[placeholder*="Teléfono"]').nth(1);
    this.inputVoucher = page.locator('input[type="file"]');
    this.btnRevisarPago = page.locator('button:has-text("REVISAR PAGO")');
    
    // Modal
    this.modalPago = page.locator('[role="dialog"]');
    this.yapeNumberText = page.locator('text=/950\\s*144\\s*641/');
    this.btnCopyYape = page.locator('button:has-text("Copiar")');
    this.btnConfirmarPago = page.locator('button:has-text("CONFIRMAR PAGO")');
    this.btnCancelarPago = page.locator('button:has-text("Cancelar")');
    
    // Confirmación
    this.modalConfirmacion = page.locator('[role="dialog"]:has-text("confirmación")');
    this.successMessage = page.locator('text=/QR generado|Reserva enviada/i');
    this.qrCodes = page.locator('img[alt*="QR"]');
    
    // Errores
    this.errorMessage = page.locator('text=/error/i, text=/inválido/i').first();
    this.dniError = page.locator('text="Documento inválido"');
  }

  /**
   * Navegar a la página de registro con código
   */
  async goto(code?: string) {
    const codeParam = code || process.env.NEXT_PUBLIC_DEFAULT_CODE || 'LOVEISLOVE';
    await this.page.goto(`/registro?code=${codeParam}`);
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Completar formulario de ticket básico
   */
  async fillTicketForm(data: {
    docType?: 'dni' | 'ce' | 'pasaporte';
    document: string;
    nombre: string;
    apellidos: string;
    email: string;
    telefono: string;
    birthdate: string;
    promoter?: string;
  }) {
    // Asegurar que estamos en la tab correcta
    await this.tabTicket.click();
    await this.page.waitForTimeout(300);

    // Tipo de documento
    if (data.docType) {
      await this.selectDocType.selectOption(data.docType.toLowerCase());
    }
    
    // Documento
    await this.inputDocument.clear();
    await this.inputDocument.fill(data.document);
    await this.page.waitForTimeout(500); // Esperar lookup automático
    
    // Nombre y apellidos (pueden autocompletarse desde RENIEC)
    const nombreValue = await this.inputNombre.inputValue();
    if (!nombreValue || nombreValue.trim() === '') {
      await this.inputNombre.fill(data.nombre);
    }
    
    const apellidosValue = await this.inputApellidos.inputValue();
    if (!apellidosValue || apellidosValue.trim() === '') {
      await this.inputApellidos.fill(data.apellidos);
    }
    
    // Email
    await this.inputEmail.fill(data.email);
    
    // Teléfono
    await this.inputTelefono.fill(data.telefono);
    
    // Fecha de nacimiento
    await this.inputBirthdate.fill(data.birthdate);
    
    // Promotor (si aplica)
    if (data.promoter && await this.selectPromoter.isVisible()) {
      await this.selectPromoter.selectOption({ label: data.promoter });
    }
  }

  /**
   * Generar QR de entrada
   */
  async generarQR() {
    await this.btnGenerarQR.click();
    
    // Esperar respuesta del servidor
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Cambiar a tab de reserva de mesa
   */
  async switchToMesaTab() {
    await this.tabMesa.click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Seleccionar mesa del plano
   */
  async selectMesa(mesaLabel: string) {
    const mesaButton = this.page.locator(`button:has-text("${mesaLabel}")`);
    await mesaButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Seleccionar producto/pack
   */
  async selectProducto(productName: string) {
    const productButton = this.page.locator(`button:has-text("${productName}")`);
    await productButton.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Completar formulario de reserva de mesa
   */
  async fillReservaForm(data: {
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    email: string;
    telefono: string;
    voucherPath?: string;
  }) {
    await this.inputReservaNombre.fill(data.nombre);
    await this.inputReservaApellidoPaterno.fill(data.apellidoPaterno);
    await this.inputReservaApellidoMaterno.fill(data.apellidoMaterno);
    await this.inputReservaEmail.fill(data.email);
    await this.inputReservaTelefono.fill(data.telefono);
    
    if (data.voucherPath) {
      await this.inputVoucher.setInputFiles(data.voucherPath);
      await this.page.waitForTimeout(1000); // Esperar upload
    }
  }

  /**
   * Confirmar pago de reserva
   */
  async confirmarPago() {
    await this.btnRevisarPago.click();
    await this.page.waitForTimeout(500);
    
    // Verificar que modal aparece
    await expect(this.modalPago).toBeVisible();
    
    // Confirmar
    await this.btnConfirmarPago.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verificar que se muestra error de validación
   */
  async expectValidationError(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.page.locator(`text="${message}"`)).toBeVisible();
    }
  }

  /**
   * Verificar éxito en generación de QR
   */
  async expectTicketSuccess() {
    await expect(this.successMessage).toBeVisible({ timeout: 10_000 });
    await expect(this.qrCodes).toBeVisible();
  }

  /**
   * Verificar éxito en reserva de mesa
   */
  async expectReservaSuccess() {
    await expect(this.successMessage).toBeVisible({ timeout: 10_000 });
  }
}
