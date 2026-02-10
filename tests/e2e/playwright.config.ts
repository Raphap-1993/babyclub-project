import { defineConfig, devices } from '@playwright/test';

/**
 * Configuración de Playwright para testing E2E de BabyClub
 * Basado en las mejores prácticas del proyecto
 */
export default defineConfig({
  testDir: './specs',
  
  /* Ejecutar tests en paralelo por archivo */
  fullyParallel: true,
  
  /* Fallar el build de CI si tests quedaron con .only */
  forbidOnly: !!process.env.CI,
  
  /* Reintentar solo en CI */
  retries: process.env.CI ? 2 : 0,
  
  /* Workers para optimizar velocidad */
  workers: process.env.CI ? 1 : undefined,
  
  /* Reporter para resultados */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
    ['json', { outputFile: 'test-results.json' }]
  ],
  
  /* Opciones compartidas para todos los tests */
  use: {
    /* URL base para navigation */
    baseURL: process.env.LANDING_URL || 'http://localhost:3001',
    
    /* Capturar screenshot solo en fallo */
    screenshot: 'only-on-failure',
    
    /* Capturar trace en fallo para debugging */
    trace: 'retain-on-failure',
    
    /* Video solo en fallo */
    video: 'retain-on-failure',
    
    /* Timeout de actions */
    actionTimeout: 10_000,
  },

  /* Configurar proyectos para diferentes navegadores */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    /* Tests móviles */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Servidor de desarrollo local */
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev:landing',
    url: 'http://localhost:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },

  /* Timeouts globales */
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
});
