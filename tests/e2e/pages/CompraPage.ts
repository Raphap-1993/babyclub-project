import { Page, Locator, expect } from '@playwright/test';

/**
 * Page Object para la página de Compra (/compra)
 * Encapsula locators y acciones del flujo de compra pública
 */
export class CompraPage {
  readonly page: Page;
  
  // Tabs de modo
  readonly tabTicket: Locator;
  readonly tabMesa: Locator;
  
  // Selector de evento
  readonly selectEvento: Locator;
  
  // Formulario de ticket
  readonly ticketDocType: Locator;
  readonly ticketDocument: Locator;
  readonly ticketNombre: Locator;
  readonly ticketApellidoPaterno: Locator;
  readonly ticketApellidoMaterno: Locator;
  readonly ticketEmail: Locator;
  readonly ticketTelefono: Locator;
  readonly ticketQuantity: Locator;
  readonly ticketVoucher: Locator;
  readonly btnRevisarTicket: Locator;
  
  // Formulario de mesa
  readonly selectMesa: Locator;
  readonly selectProduct: Locator;
  readonly mesaDocType: Locator;
  readonly mesaDocument: Locator;
  readonly mesaNombre: Locator;
  readonly mesaApellidoPaterno: Locator;
  readonly mesaApellidoMaterno: Locator;
  readonly mesaEmail: Locator;
  readonly mesaTelefono: Locator;
  readonly mesaVoucher: Locator;
  readonly btnRevisarMesa: Locator;
  
  // Modal de resumen/pago
  readonly modalResumen: Locator;
  readonly yapeNumber: Locator;
  readonly btnCopyYape: Locator;
  readonly btnConfirmar: Locator;
  readonly btnCancelar: Locator;
  
  // Confirmación
  readonly modalConfirmacion: Locator;
  readonly reservationId: Locator;
  readonly btnVolver: Locator;
  
  // Errores
  readonly errorMessage: Locator;
  readonly dniError: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Tabs
    this.tabTicket = page.locator('button:has-text("Solo entrada")');
    this.tabMesa = page.locator('button:has-text("Reserva mesa")');
    
    // Evento
    this.selectEvento = page.locator('select').first();
    
    // Ticket form
    this.ticketDocType = page.locator('select[id*="ticket"], select').nth(0);
    this.ticketDocument = page.locator('input[placeholder*="documento"]').first();
    this.ticketNombre = page.locator('input[placeholder*="Nombre"]').first();
    this.ticketApellidoPaterno = page.locator('input[placeholder*="Apellido paterno"]').first();
    this.ticketApellidoMaterno = page.locator('input[placeholder*="Apellido materno"]').first();
    this.ticketEmail = page.locator('input[type="email"]').first();
    this.ticketTelefono = page.locator('input[placeholder*="Teléfono"]').first();
    this.ticketQuantity = page.locator('button:has-text("1"), button:has-text("2")').first();
    this.ticketVoucher = page.locator('input[type="file"]').first();
    this.btnRevisarTicket = page.locator('button:has-text("REVISAR PAGO Y ENVIAR")');
    
    // Mesa form
    this.selectMesa = page.locator('button[role="button"]:has-text("Box"), button[role="button"]:has-text("Mesa")').first();
    this.selectProduct = page.locator('button[role="button"]:has-text("Pack")').first();
    this.mesaDocType = page.locator('select').nth(1);
    this.mesaDocument = page.locator('input[placeholder*="documento"]').nth(1);
    this.mesaNombre = page.locator('input[placeholder*="Nombre"]').nth(1);
    this.mesaApellidoPaterno = page.locator('input[placeholder*="Apellido paterno"]').nth(1);
    this.mesaApellidoMaterno = page.locator('input[placeholder*="Apellido materno"]').nth(1);
    this.mesaEmail = page.locator('input[type="email"]').nth(1);
    this.mesaTelefono = page.locator('input[placeholder*="Teléfono"]').nth(1);
    this.mesaVoucher = page.locator('input[type="file"]').nth(1);
    this.btnRevisarMesa = page.locator('button:has-text("REVISAR PAGO Y ENVIAR")');
    
    // Modal
    this.modalResumen = page.locator('[role="dialog"]');
    this.yapeNumber = page.locator('text=/950\\s*144\\s*641/');
    this.btnCopyYape = page.locator('button:has-text("Copiar")');
    this.btnConfirmar = page.locator('button:has-text("CONFIRMAR")');
    this.btnCancelar = page.locator('button:has-text("Cancelar")');
    
    // Confirmación
    this.modalConfirmacion = page.locator('[role="dialog"]:has-text("confirmación")');
    this.reservationId = page.locator('text=/ID.*reserva/i');
    this.btnVolver = page.locator('button:has-text("← Volver")');
    
    // Errores
    this.errorMessage = page.locator('text=/error/i, text=/inválido/i').first();
    this.dniError = page.locator('text="Documento inválido"');
  }

  /**
   * Navegar a página de compra
   */
  async goto() {
    await this.page.goto('/compra');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Seleccionar evento
   */
  async selectEvento(eventoName: string) {
    await this.selectEvento.selectOption({ label: eventoName });
    await this.page.waitForTimeout(500);
  }

  /**
   * Cambiar a modo ticket
   */
  async switchToTicketMode() {
    await this.tabTicket.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Cambiar a modo mesa
   */
  async switchToMesaMode() {
    await this.tabMesa.click();
    await this.page.waitForTimeout(300);
  }

  /**
   * Completar formulario de compra de ticket
   */
  async fillTicketForm(data: {
    docType?: 'dni' | 'ce' | 'pasaporte';
    document: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    email: string;
    telefono: string;
    quantity?: 1 | 2;
    voucherPath?: string;
  }) {
    if (data.docType) {
      await this.ticketDocType.selectOption(data.docType.toLowerCase());
    }
    
    await this.ticketDocument.fill(data.document);
    await this.page.waitForTimeout(500);
    
    await this.ticketNombre.fill(data.nombre);
    await this.ticketApellidoPaterno.fill(data.apellidoPaterno);
    await this.ticketApellidoMaterno.fill(data.apellidoMaterno);
    await this.ticketEmail.fill(data.email);
    await this.ticketTelefono.fill(data.telefono);
    
    if (data.quantity) {
      const qtyButton = this.page.locator(`button:has-text("${data.quantity}")`);
      await qtyButton.click();
    }
    
    if (data.voucherPath) {
      await this.ticketVoucher.setInputFiles(data.voucherPath);
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Completar formulario de compra de mesa
   */
  async fillMesaForm(data: {
    mesa: string;
    producto: string;
    docType?: 'dni' | 'ce' | 'pasaporte';
    document: string;
    nombre: string;
    apellidoPaterno: string;
    apellidoMaterno: string;
    email: string;
    telefono: string;
    voucherPath?: string;
  }) {
    // Seleccionar mesa
    const mesaBtn = this.page.locator(`button:has-text("${data.mesa}")`);
    await mesaBtn.click();
    await this.page.waitForTimeout(300);
    
    // Seleccionar producto
    const prodBtn = this.page.locator(`button:has-text("${data.producto}")`);
    await prodBtn.click();
    await this.page.waitForTimeout(300);
    
    if (data.docType) {
      await this.mesaDocType.selectOption(data.docType.toLowerCase());
    }
    
    await this.mesaDocument.fill(data.document);
    await this.page.waitForTimeout(500);
    
    await this.mesaNombre.fill(data.nombre);
    await this.mesaApellidoPaterno.fill(data.apellidoPaterno);
    await this.mesaApellidoMaterno.fill(data.apellidoMaterno);
    await this.mesaEmail.fill(data.email);
    await this.mesaTelefono.fill(data.telefono);
    
    if (data.voucherPath) {
      await this.mesaVoucher.setInputFiles(data.voucherPath);
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Revisar y confirmar compra de ticket
   */
  async confirmarTicket() {
    await this.btnRevisarTicket.click();
    await this.page.waitForTimeout(500);
    
    await expect(this.modalResumen).toBeVisible();
    
    await this.btnConfirmar.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Revisar y confirmar compra de mesa
   */
  async confirmarMesa() {
    await this.btnRevisarMesa.click();
    await this.page.waitForTimeout(500);
    
    await expect(this.modalResumen).toBeVisible();
    
    await this.btnConfirmar.click();
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verificar éxito en compra
   */
  async expectCompraSuccess() {
    await expect(this.modalConfirmacion).toBeVisible({ timeout: 10_000 });
    await expect(this.reservationId).toBeVisible();
  }

  /**
   * Verificar error de validación
   */
  async expectValidationError(message?: string) {
    await expect(this.errorMessage).toBeVisible();
    if (message) {
      await expect(this.page.locator(`text="${message}"`)).toBeVisible();
    }
  }

  /**
   * Copiar número de Yape
   */
  async copyYapeNumber() {
    await this.btnCopyYape.click();
    await this.page.waitForTimeout(300);
  }
}
