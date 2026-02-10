import { test, expect } from '../fixtures';

/**
 * Suite de pruebas E2E para el flujo de Registro con código
 * Cubre los casos principales del formulario /registro
 */

test.describe('Flujo de Registro - Solo Entrada', () => {
  test.beforeEach(async ({ registroPage, testData }) => {
    await registroPage.goto(testData.validCode);
  });

  test('debe cargar la página correctamente', async ({ registroPage, page }) => {
    // Verificar elementos principales
    await expect(registroPage.heroImage).toBeVisible();
    await expect(registroPage.tabTicket).toBeVisible();
    await expect(registroPage.tabMesa).toBeVisible();
    await expect(page).toHaveTitle(/Baby|BABY/);
  });

  test('debe mostrar aforo actual', async ({ registroPage }) => {
    // Verificar que se muestra el porcentaje de aforo
    await expect(registroPage.aforoLabel).toBeVisible();
  });

  test('debe validar DNI inválido', async ({ registroPage, testData }) => {
    await registroPage.fillTicketForm({
      document: testData.invalidDNI,
      nombre: testData.validName,
      apellidos: testData.validApellidos,
      email: testData.validEmail,
      telefono: testData.validPhone,
      birthdate: testData.validBirthdate,
    });

    await registroPage.generarQR();
    await registroPage.expectValidationError('Documento inválido');
  });

  test('debe generar QR con DNI válido', async ({ registroPage, testData }) => {
    await registroPage.fillTicketForm({
      docType: 'dni',
      document: testData.validDNI,
      nombre: testData.validName,
      apellidos: testData.validApellidos,
      email: testData.validEmail,
      telefono: testData.validPhone,
      birthdate: testData.validBirthdate,
    });

    await registroPage.generarQR();
    await registroPage.expectTicketSuccess();
  });

  test('debe generar QR con Carnet de Extranjería', async ({ registroPage, testData }) => {
    await registroPage.fillTicketForm({
      docType: 'ce',
      document: testData.validCE,
      nombre: testData.validName,
      apellidos: testData.validApellidos,
      email: testData.validEmail,
      telefono: testData.validPhone,
      birthdate: testData.validBirthdate,
    });

    await registroPage.generarQR();
    await registroPage.expectTicketSuccess();
  });

  test('debe generar QR con Pasaporte', async ({ registroPage, testData }) => {
    await registroPage.fillTicketForm({
      docType: 'pasaporte',
      document: testData.validPasaporte,
      nombre: testData.validName,
      apellidos: testData.validApellidos,
      email: testData.validEmail,
      telefono: testData.validPhone,
      birthdate: testData.validBirthdate,
    });

    await registroPage.generarQR();
    await registroPage.expectTicketSuccess();
  });

  test('debe validar campos obligatorios', async ({ registroPage, testData }) => {
    // Intentar generar QR sin llenar formulario
    await registroPage.generarQR();
    
    // Verificar que HTML5 validation detiene el submit
    const isFormInvalid = await registroPage.page.evaluate(() => {
      const form = document.querySelector('form');
      return form ? !form.checkValidity() : false;
    });
    
    expect(isFormInvalid).toBe(true);
  });

  test('debe validar edad mínima (18 años)', async ({ registroPage, testData }) => {
    // Fecha de nacimiento de menor de edad
    const fechaMenor = new Date();
    fechaMenor.setFullYear(fechaMenor.getFullYear() - 17);
    const birthdateMenor = fechaMenor.toISOString().split('T')[0];

    await registroPage.fillTicketForm({
      document: testData.validDNI,
      nombre: testData.validName,
      apellidos: testData.validApellidos,
      email: testData.validEmail,
      telefono: testData.validPhone,
      birthdate: birthdateMenor,
    });

    await registroPage.generarQR();
    
    // Verificar validación HTML5 o mensaje de error
    const errorVisible = await registroPage.errorMessage.isVisible().catch(() => false);
    const formInvalid = await registroPage.page.evaluate(() => {
      const dateInput = document.querySelector('input[type="date"]');
      return dateInput ? !(dateInput as HTMLInputElement).checkValidity() : false;
    });
    
    expect(errorVisible || formInvalid).toBe(true);
  });

  test('debe mostrar selector de promotor cuando aplique', async ({ registroPage, testData }) => {
    // Verificar si el selector está visible (depende del tipo de código)
    const isVisible = await registroPage.selectPromoter.isVisible().catch(() => false);
    
    if (isVisible) {
      // Si está visible, debe tener opciones
      const options = await registroPage.selectPromoter.locator('option').count();
      expect(options).toBeGreaterThan(0);
    }
  });
});

test.describe('Flujo de Registro - Reserva de Mesa', () => {
  test.beforeEach(async ({ registroPage, testData }) => {
    await registroPage.goto(testData.validCode);
    await registroPage.switchToMesaTab();
  });

  test('debe mostrar plano de mesas', async ({ registroPage, page }) => {
    // Verificar que existe el mapa o selector de mesas
    const mapVisible = await page.locator('svg, img[alt*="plano"], canvas').first().isVisible();
    const selectVisible = await registroPage.selectTable.isVisible();
    
    expect(mapVisible || selectVisible).toBe(true);
  });

  test('debe permitir seleccionar mesa disponible', async ({ registroPage }) => {
    // Intentar seleccionar una mesa (Mesa 1 o Box 1)
    try {
      await registroPage.selectMesa('Box 1');
    } catch {
      await registroPage.selectMesa('Mesa 1');
    }
    
    // Verificar que se puede continuar
    await expect(registroPage.btnRevisarPago).toBeEnabled();
  });

  test('debe mostrar productos/packs de la mesa seleccionada', async ({ registroPage, page }) => {
    // Seleccionar mesa
    try {
      await registroPage.selectMesa('Box 1');
    } catch {
      await registroPage.selectMesa('Mesa 1');
    }
    
    // Verificar que hay productos
    const hasProducts = await page.locator('text=/Pack|Combo|Consumo/i').count();
    expect(hasProducts).toBeGreaterThan(0);
  });

  test('debe validar campos obligatorios de reserva', async ({ registroPage }) => {
    // Intentar enviar sin llenar
    await registroPage.btnRevisarPago.click();
    
    const isFormInvalid = await registroPage.page.evaluate(() => {
      const forms = document.querySelectorAll('form');
      return Array.from(forms).some(form => !form.checkValidity());
    });
    
    expect(isFormInvalid).toBe(true);
  });

  test('debe mostrar modal de pago Yape', async ({ registroPage, testData }) => {
    // Seleccionar mesa y producto
    try {
      await registroPage.selectMesa('Box 1');
    } catch {
      await registroPage.selectMesa('Mesa 1');
    }
    
    // Llenar formulario básico
    await registroPage.fillReservaForm({
      nombre: testData.validName,
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'García',
      email: testData.validEmail,
      telefono: testData.validPhone,
    });
    
    await registroPage.btnRevisarPago.click();
    
    // Verificar modal
    await expect(registroPage.modalPago).toBeVisible();
    await expect(registroPage.yapeNumberText).toBeVisible();
  });

  test('debe permitir copiar número de Yape', async ({ registroPage, testData, page }) => {
    // Setup
    try {
      await registroPage.selectMesa('Box 1');
    } catch {
      await registroPage.selectMesa('Mesa 1');
    }
    
    await registroPage.fillReservaForm({
      nombre: testData.validName,
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'García',
      email: testData.validEmail,
      telefono: testData.validPhone,
    });
    
    await registroPage.btnRevisarPago.click();
    await expect(registroPage.modalPago).toBeVisible();
    
    // Copiar número
    await registroPage.btnCopyYape.click();
    
    // Verificar que se copió al clipboard (si el navegador lo permite)
    const clipboardText = await page.evaluate(() => {
      return navigator.clipboard.readText().catch(() => '');
    });
    
    // Si clipboard está disponible, verificar contenido
    if (clipboardText) {
      expect(clipboardText).toContain('950');
    }
  });

  test('debe cancelar reserva desde modal', async ({ registroPage, testData }) => {
    try {
      await registroPage.selectMesa('Box 1');
    } catch {
      await registroPage.selectMesa('Mesa 1');
    }
    
    await registroPage.fillReservaForm({
      nombre: testData.validName,
      apellidoPaterno: 'Pérez',
      apellidoMaterno: 'García',
      email: testData.validEmail,
      telefono: testData.validPhone,
    });
    
    await registroPage.btnRevisarPago.click();
    await expect(registroPage.modalPago).toBeVisible();
    
    // Cancelar
    await registroPage.btnCancelarPago.click();
    
    // Verificar que modal se cierra
    await expect(registroPage.modalPago).not.toBeVisible();
  });
});

test.describe('Flujo de Registro - Validaciones de Documento', () => {
  test.beforeEach(async ({ registroPage, testData }) => {
    await registroPage.goto(testData.validCode);
  });

  test('debe rechazar DNI con menos de 8 dígitos', async ({ registroPage }) => {
    await registroPage.fillTicketForm({
      docType: 'dni',
      document: '1234567', // 7 dígitos
      nombre: 'Test',
      apellidos: 'User',
      email: 'test@test.com',
      telefono: '999999999',
      birthdate: '1990-01-01',
    });

    await registroPage.generarQR();
    await registroPage.expectValidationError();
  });

  test('debe rechazar DNI con caracteres no numéricos', async ({ registroPage }) => {
    await registroPage.fillTicketForm({
      docType: 'dni',
      document: '1234567A',
      nombre: 'Test',
      apellidos: 'User',
      email: 'test@test.com',
      telefono: '999999999',
      birthdate: '1990-01-01',
    });

    await registroPage.generarQR();
    await registroPage.expectValidationError();
  });

  test('debe validar formato de email', async ({ registroPage, testData }) => {
    await registroPage.fillTicketForm({
      document: testData.validDNI,
      nombre: testData.validName,
      apellidos: testData.validApellidos,
      email: 'email-invalido',
      telefono: testData.validPhone,
      birthdate: testData.validBirthdate,
    });

    await registroPage.generarQR();
    
    // HTML5 validation debe detectar email inválido
    const emailInput = registroPage.inputEmail;
    const isValid = await emailInput.evaluate((el: HTMLInputElement) => el.checkValidity());
    expect(isValid).toBe(false);
  });
});
