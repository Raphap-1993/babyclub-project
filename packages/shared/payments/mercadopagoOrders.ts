import { PaymentServiceError } from "./errors";

// Orders has a different contract from Culqi's order/charge flow. Do not register
// it in the legacy gateway until its persistence and fulfillment are wired.
export type MercadoPagoOrder = {
  id: string;
  type: string;
  status: string;
  status_detail: string;
  external_reference: string;
  country_code: string;
  currency_id?: string;
  user_id: string | number;
  integration_data?: { application_id?: string | number };
  total_amount: string;
  total_paid_amount?: string;
  transactions?: {
    payments?: Array<{
      id: string;
      status: string;
      status_detail: string;
      amount: string;
      paid_amount?: string;
    }>;
  };
};

export function formatMercadoPagoAmount(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents <= 0) {
    throw new PaymentServiceError("Importe de pago inválido", 400);
  }
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

export function parseMercadoPagoAmount(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d+(?:\.\d{1,2})?$/.test(value))
    return null;
  const [whole, decimal = ""] = value.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export type MercadoPagoCardOrderInput = {
  amountCents: number; // Obtained from a persisted server quote, never the Brick amount.
  externalReference: string;
  idempotencyKey: string;
  payer: { email: string; identification?: { type: string; number: string } };
  paymentMethod: {
    id: string;
    type: "credit_card" | "debit_card";
    token: string;
    installments: number;
  };
};

export function buildMercadoPagoCardOrder(input: MercadoPagoCardOrderInput) {
  const amount = formatMercadoPagoAmount(input.amountCents);
  // MP.js labels the Peruvian foreign-resident document "C.E" while Orders
  // accepts "CE". Keep the normalization at the provider boundary.
  const identification = input.payer.identification
    ? {
        type:
          typeof input.payer.identification.type === "string"
            ? input.payer.identification.type
                .replace(/[.\s]/g, "")
                .toUpperCase()
            : "",
        number:
          typeof input.payer.identification.number === "string"
            ? input.payer.identification.number.trim()
            : "",
      }
    : undefined;
  if (
    !/^[\w-]{1,64}$/.test(input.externalReference) ||
    !/^[\w-]{16,64}$/.test(input.idempotencyKey)
  ) {
    throw new PaymentServiceError(
      "Referencia o idempotencia de pago inválida",
      400,
    );
  }
  const method = input.paymentMethod;
  if (
    typeof method.token !== "string" ||
    !method.token.trim() ||
    method.token.length > 512 ||
    !/^[a-z0-9_]{1,64}$/.test(method.id) ||
    method.id === "yape" ||
    !["credit_card", "debit_card"].includes(method.type) ||
    !Number.isInteger(method.installments) ||
    method.installments < 1 ||
    method.installments > 48
  ) {
    throw new PaymentServiceError("Datos de tarjeta inválidos", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.payer.email)) {
    throw new PaymentServiceError("Correo del pagador inválido", 400);
  }
  if (
    identification &&
    (!["DNI", "CE", "RUC"].includes(identification.type) ||
      !/^[a-zA-Z0-9-]{3,32}$/.test(identification.number))
  ) {
    throw new PaymentServiceError(
      "Usa DNI, C.E o RUC como documento del pagador",
      400,
    );
  }
  // Explicit fields prevent browser-supplied amounts or arbitrary metadata from
  // reaching Orders. This payload is transient and must never be logged/stored.
  return {
    type: "online",
    processing_mode: "automatic",
    total_amount: amount,
    external_reference: input.externalReference,
    payer: {
      email: input.payer.email,
      ...(identification
        ? {
            identification: {
              type: identification.type,
              number: identification.number,
            },
          }
        : {}),
    },
    transactions: {
      payments: [
        {
          amount,
          payment_method: {
            id: method.id,
            type: method.type,
            token: method.token,
            installments: method.installments,
          },
        },
      ],
    },
  };
}

async function ordersRequest(
  path: string,
  accessToken: string,
  init: RequestInit,
) {
  if (!accessToken.trim())
    throw new PaymentServiceError("Falta configurar Mercado Pago", 503);
  let response: Response;
  try {
    response = await fetch(`https://api.mercadopago.com/v1/orders${path}`, {
      ...init,
      headers: {
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    // A timeout is ambiguous: retry ONLY the same persisted attempt/key.
    throw new PaymentServiceError(
      "No pudimos confirmar la respuesta del pago. Conserva el intento para verificarlo.",
      502,
      "payment_result_unknown",
    );
  }
  if (!response.ok) {
    const failure = await response.json().catch(() => ({}));
    const codes = [
      failure.error,
      failure.code,
      ...(Array.isArray(failure.errors)
        ? failure.errors.map((item: any) => item.code)
        : []),
    ].filter(
      (code: unknown) =>
        typeof code === "string" &&
        /^[a-zA-Z0-9_.-]{1,100}$/.test(code as string),
    );
    const fields = (Array.isArray(failure.errors) ? failure.errors : [])
      .flatMap((item: any) => [
        item.field,
        item.property,
        item.path,
        ...(Array.isArray(item.details)
          ? item.details.map(
              (detail: any) => detail.field || detail.path || detail.property,
            )
          : []),
      ])
      .filter(
        (field: unknown) =>
          typeof field === "string" &&
          /^(transactions|payments|payer|total_amount|external_reference|processing_mode|type)[a-zA-Z0-9_.\[\]]*$/.test(
            field as string,
          ),
      );
    const invalidFields =
      JSON.stringify(failure.errors || []).match(
        /(?:payer|transactions|total_amount|external_reference|processing_mode)(?:\.[a-zA-Z_]+|\[\d\])*/g,
      ) || [];
    const sentType =
      typeof init.body === "string"
        ? JSON.parse(init.body).payer?.identification?.type
        : undefined;
    console.warn(
      JSON.stringify({
        event: "mercadopago_orders_rejected",
        status: response.status,
        codes,
        fields,
        invalidFields,
        sentDocumentType:
          typeof sentType === "string" && /^[a-zA-Z. ]{1,8}$/.test(sentType)
            ? sentType
            : undefined,
      }),
    );
    throw new PaymentServiceError(
      [400, 422].includes(response.status)
        ? "Mercado Pago no aprobó este intento. Revisa los datos o utiliza otra tarjeta."
        : "Mercado Pago no está disponible para procesar este intento en este momento.",
      502,
      [400, 401, 403, 404, 422].includes(response.status)
        ? "mercadopago_request_rejected"
        : "mercadopago_api_error",
    );
  }
  let data: MercadoPagoOrder;
  try {
    data = await response.json();
  } catch {
    throw new PaymentServiceError(
      "Respuesta de pago inválida",
      502,
      "payment_result_unknown",
    );
  }
  if (!data || typeof data.id !== "string" || typeof data.status !== "string") {
    throw new PaymentServiceError(
      "Respuesta de pago incompleta",
      502,
      "payment_result_unknown",
    );
  }
  return data;
}

export function createMercadoPagoCardOrder(
  input: MercadoPagoCardOrderInput,
  accessToken: string,
) {
  return ordersRequest("", accessToken, {
    method: "POST",
    headers: { "X-Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify(buildMercadoPagoCardOrder(input)),
  });
}

export async function getMercadoPagoOrder(
  orderId: string,
  accessToken: string,
) {
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(orderId)) {
    throw new PaymentServiceError("Identificador de orden inválido", 400);
  }
  const order = await ordersRequest(
    `/${encodeURIComponent(orderId)}`,
    accessToken,
    { method: "GET" },
  );
  if (order.id !== orderId)
    throw new PaymentServiceError("La orden recibida no coincide", 502);
  return order;
}

export async function findMercadoPagoOrder(
  externalReference: string,
  createdAt: string,
  accessToken: string,
): Promise<string | null> {
  if (
    !/^[a-f0-9-]{36}$/i.test(externalReference) ||
    !Number.isFinite(Date.parse(createdAt))
  )
    throw new PaymentServiceError("Referencia de compra inválida", 400);
  const query = new URLSearchParams({
    external_reference: externalReference,
    type: "online",
    page_size: "2",
    begin_date: new Date(Date.parse(createdAt) - 300_000).toISOString(),
    end_date: new Date(Date.now() + 60_000).toISOString(),
  });
  let response: Response;
  try {
    response = await fetch(`https://api.mercadopago.com/v1/orders?${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new PaymentServiceError(
      "El pago continúa en verificación",
      502,
      "payment_result_unknown",
    );
  }
  if (!response.ok)
    throw new PaymentServiceError(
      "El pago continúa en verificación",
      502,
      "payment_result_unknown",
    );
  const result = await response.json();
  if (!Array.isArray(result.data) || result.data.length > 1)
    throw new PaymentServiceError(
      "La compra requiere revisión",
      409,
      "payment_result_unknown",
    );
  const order = result.data[0];
  if (!order) return null; // Absence is NOT evidence that charging again is safe.
  if (
    order.external_reference !== externalReference ||
    typeof order.id !== "string"
  )
    throw new PaymentServiceError("La orden no coincide con la compra", 409);
  return order.id;
}

export function evaluateMercadoPagoOrder(
  order: MercadoPagoOrder,
  expected: {
    orderId: string;
    externalReference: string;
    amountCents: number;
    collectorId: string;
    applicationId: string;
  },
): "paid" | "pending" | "failed" | "canceled" | "refunded" | "review" {
  if (
    !Number.isSafeInteger(expected.amountCents) ||
    expected.amountCents <= 0 ||
    order.id !== expected.orderId ||
    order.external_reference !== expected.externalReference ||
    String(order.user_id) !== expected.collectorId ||
    String(order.integration_data?.application_id) !== expected.applicationId ||
    order.country_code !== "PER" ||
    (order.currency_id && order.currency_id !== "PEN") ||
    order.type !== "online" ||
    parseMercadoPagoAmount(order.total_amount) !== expected.amountCents
  )
    return "review";
  if (order.status === "processed" && order.status_detail === "accredited") {
    const payments = order.transactions?.payments;
    if (
      parseMercadoPagoAmount(order.total_paid_amount) !==
        expected.amountCents ||
      !payments ||
      payments.length !== 1 ||
      payments[0].status !== "processed" ||
      payments[0].status_detail !== "accredited" ||
      parseMercadoPagoAmount(payments[0].amount) !== expected.amountCents ||
      parseMercadoPagoAmount(payments[0].paid_amount) !== expected.amountCents
    )
      return "review";
    return "paid";
  }
  if (order.status === "refunded") return "refunded";
  if (order.status === "failed") return "failed";
  if (order.status === "canceled") return "canceled";
  if (["created", "processing", "action_required"].includes(order.status))
    return "pending";
  return "review";
}
