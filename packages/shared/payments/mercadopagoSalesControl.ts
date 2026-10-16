import { PaymentServiceError } from "./errors";

export type MercadoPagoSalesControl = {
  paused: boolean;
  version: number;
  updated_at: string;
  updated_by: string | null;
};

export async function readMercadoPagoSalesControl(
  db: any,
): Promise<MercadoPagoSalesControl> {
  const { data, error } = await db
    .from("mp_sales_control")
    .select("paused,version,updated_at,updated_by")
    .eq("id", true)
    .single();
  if (
    error ||
    !data ||
    typeof data.paused !== "boolean" ||
    !Number.isInteger(data.version)
  ) {
    throw new PaymentServiceError(
      "No se pudo verificar la disponibilidad de ventas",
      503,
      "sales_control_unavailable",
    );
  }
  return data;
}

export async function assertMercadoPagoSalesOpen(db: any) {
  if ((await readMercadoPagoSalesControl(db)).paused) {
    throw new PaymentServiceError(
      "La venta de entradas y mesas está pausada temporalmente. Tus compras anteriores siguen vigentes.",
      503,
      "mercadopago_sales_paused",
    );
  }
}
