import { culqiGateway } from "./culqi";
import { PaymentServiceError } from "./errors";
import type { PaymentGateway, PaymentProvider } from "./types";

const paymentGatewayRegistry = {
  culqi: culqiGateway,
} satisfies Record<PaymentProvider, PaymentGateway>;

export function getPaymentGateway(providerName: string) {
  const normalized = providerName.trim().toLowerCase();
  if (!normalized) {
    throw new PaymentServiceError(
      "provider es requerido",
      400,
      "payment_provider_required",
    );
  }

  const gateway = paymentGatewayRegistry[normalized as PaymentProvider];
  if (!gateway) {
    throw new PaymentServiceError(
      `Proveedor de pago no soportado: ${normalized}`,
      404,
      "payment_provider_not_supported",
    );
  }

  return gateway;
}

export function requireEnabledPaymentGateway(providerName: string) {
  const gateway = getPaymentGateway(providerName);
  if (!gateway.isEnabled()) {
    throw new PaymentServiceError(
      "payments_module_disabled",
      503,
      "payments_module_disabled",
    );
  }
  return gateway;
}

export function hasEnabledPaymentGateway() {
  return Object.values(paymentGatewayRegistry).some((gateway) =>
    gateway.isEnabled(),
  );
}
