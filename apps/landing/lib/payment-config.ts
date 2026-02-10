/**
 * Payment Methods Configuration
 * 
 * Este archivo centraliza la configuración de métodos de pago
 * para facilitar la transición de reserva manual a pasarelas online
 */

export type PaymentMethod = 'reservation' | 'izipay' | 'culqi';

export type PaymentConfig = {
  method: PaymentMethod;
  enabled: boolean;
  requiresVoucher: boolean;
  supportsInstantConfirmation: boolean;
  displayName: string;
};

/**
 * Configuración actual del método de pago
 */
export function getPaymentConfig(): PaymentConfig {
  const method = (process.env.PAYMENT_METHOD || 'reservation') as PaymentMethod;
  const enableOnlinePayments = process.env.ENABLE_ONLINE_PAYMENTS === 'true';

  switch (method) {
    case 'izipay':
      return {
        method: 'izipay',
        enabled: enableOnlinePayments,
        requiresVoucher: false,
        supportsInstantConfirmation: true,
        displayName: 'Izipay (Niubiz)',
      };

    case 'culqi':
      return {
        method: 'culqi',
        enabled: enableOnlinePayments && process.env.ENABLE_CULQI_PAYMENTS === 'true',
        requiresVoucher: false,
        supportsInstantConfirmation: true,
        displayName: 'Culqi',
      };

    case 'reservation':
    default:
      return {
        method: 'reservation',
        enabled: true,
        requiresVoucher: true,
        supportsInstantConfirmation: false,
        displayName: 'Reserva con Yape/Plin',
      };
  }
}

/**
 * Verifica si se deben mostrar opciones de pago online
 */
export function shouldShowOnlinePayment(): boolean {
  const config = getPaymentConfig();
  return config.enabled && !config.requiresVoucher;
}

/**
 * Verifica si se requiere subir comprobante
 */
export function requiresVoucherUpload(): boolean {
  const config = getPaymentConfig();
  return config.requiresVoucher;
}

/**
 * Obtiene el texto de instrucción de pago según el método activo
 */
export function getPaymentInstructions(): string {
  const config = getPaymentConfig();
  
  switch (config.method) {
    case 'izipay':
      return 'Pagarás de forma segura con tarjeta de crédito o débito a través de Niubiz.';
    
    case 'culqi':
      return 'Pagarás de forma segura con tarjeta de crédito o débito a través de Culqi.';
    
    case 'reservation':
    default:
      return 'Envía el pago por Yape o Plin y sube tu comprobante. Validaremos tu reserva manualmente.';
  }
}

/**
 * Obtiene el CTA del botón de pago según el método
 */
export function getPaymentButtonText(): string {
  const config = getPaymentConfig();
  
  if (config.supportsInstantConfirmation) {
    return 'Pagar ahora';
  }
  
  return 'Revisar pago y enviar';
}

/**
 * Configuración específica de Izipay
 */
export const IZIPAY_CONFIG = {
  merchantId: process.env.IZIPAY_MERCHANT_ID || '',
  accessKey: process.env.IZIPAY_ACCESS_KEY || '',
  secretKey: process.env.IZIPAY_SECRET_KEY || '',
  apiBaseUrl: process.env.IZIPAY_API_BASE_URL || 'https://apisandbox.vnforappstest.com',
  currency: 'PEN',
  country: 'PE',
};

/**
 * Configuración específica de Culqi (legacy)
 */
export const CULQI_CONFIG = {
  secretKey: process.env.CULQI_SECRET_KEY || '',
  apiBaseUrl: process.env.CULQI_API_BASE_URL || 'https://api.culqi.com/v2',
  currency: 'PEN',
};
