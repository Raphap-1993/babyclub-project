export class PaymentServiceError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status = 500, code?: string) {
    super(message);
    this.name = "PaymentServiceError";
    this.status = status;
    this.code = code;
  }
}

export function toPaymentServiceError(error: unknown) {
  if (error instanceof PaymentServiceError) {
    return error;
  }

  if (error instanceof Error) {
    return new PaymentServiceError(error.message, 500);
  }

  return new PaymentServiceError("Internal server error", 500);
}
