export type PaymentProvider = "culqi";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "expired"
  | "canceled";

export type PaymentGatewayHeaders = {
  get(name: string): string | null;
};

export type CreateGatewayOrderInput = {
  amount: number;
  currencyCode?: string;
  description: string;
  orderNumber: string;
  expirationDateUnix: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phoneNumber: string;
  };
  metadata?: Record<string, unknown>;
};

export type CreateGatewayOrderResult = {
  orderId: string;
  raw: unknown;
};

export type CreateGatewayRefundInput = {
  chargeId: string;
  amount: number;
  reason: string;
  metadata?: Record<string, unknown>;
};

export type CreateGatewayRefundResult = {
  raw: unknown;
};

export type ParseGatewayWebhookInput = {
  rawBody: string;
  headers: PaymentGatewayHeaders;
};

export type ParsedGatewayWebhook = {
  eventName: string;
  eventId: string | null;
  eventKey: string;
  signature: string | null;
  signatureValid: boolean | null;
  orderId: string | null;
  chargeId: string | null;
  status: PaymentStatus;
  amount: number | null;
  currencyCode: string;
  customerEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  metadata: Record<string, unknown>;
  raw: unknown;
};

export type PaymentGateway = {
  provider: PaymentProvider;
  isEnabled(): boolean;
  createOrder(
    input: CreateGatewayOrderInput,
  ): Promise<CreateGatewayOrderResult>;
  createRefund(
    input: CreateGatewayRefundInput,
  ): Promise<CreateGatewayRefundResult>;
  parseWebhook(input: ParseGatewayWebhookInput): ParsedGatewayWebhook;
};
