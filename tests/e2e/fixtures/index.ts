import { test as base } from '@playwright/test';
import { RegistroPage } from '../pages/RegistroPage';
import { CompraPage } from '../pages/CompraPage';
import { AccesoPage } from '../pages/AccesoPage';

/**
 * Fixtures para pruebas E2E de BabyClub
 * Centraliza la creación de Page Objects y datos de prueba
 */

type BabyClubFixtures = {
  registroPage: RegistroPage;
  compraPage: CompraPage;
  accesoPage: AccesoPage;
  testData: TestData;
};

type TestData = {
  validDNI: string;
  validCE: string;
  validPasaporte: string;
  invalidDNI: string;
  validEmail: string;
  validPhone: string;
  validName: string;
  validApellidos: string;
  validBirthdate: string;
  validCode: string;
};

export const test = base.extend<BabyClubFixtures>({
  registroPage: async ({ page }, use) => {
    const registroPage = new RegistroPage(page);
    await use(registroPage);
  },

  compraPage: async ({ page }, use) => {
    const compraPage = new CompraPage(page);
    await use(compraPage);
  },

  accesoPage: async ({ page }, use) => {
    const accesoPage = new AccesoPage(page);
    await use(accesoPage);
  },

  testData: async ({}, use) => {
    const testData: TestData = {
      // DNI válido para testing (8 dígitos)
      validDNI: '12345678',
      
      // Carnet de extranjería válido
      validCE: '001234567',
      
      // Pasaporte válido
      validPasaporte: 'ABC123456',
      
      // DNI inválido (formato incorrecto)
      invalidDNI: '1234',
      
      // Email válido
      validEmail: 'test@baby.club',
      
      // Teléfono válido
      validPhone: '+51 999 999 999',
      
      // Nombre válido
      validName: 'Juan Carlos',
      
      // Apellidos válidos
      validApellidos: 'Pérez García',
      
      // Fecha de nacimiento válida (mayor de 18 años)
      validBirthdate: '1995-06-15',
      
      // Código de acceso por defecto
      validCode: process.env.NEXT_PUBLIC_DEFAULT_CODE || 'LOVEISLOVE',
    };
    
    await use(testData);
  },
});

export { expect } from '@playwright/test';
