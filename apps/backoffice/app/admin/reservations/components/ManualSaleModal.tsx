"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { authedFetch } from "@/lib/authedFetch";
import { DOCUMENT_TYPES } from "shared/document";

type Option = { id: string; name: string };
type TicketType = {
  code: string;
  label: string;
  ticket_quantity: number;
  price: number;
  is_active: boolean;
};
type Product = Option & { price: number; tickets_included?: number };
const money = (amount: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    amount,
  );

export default function ManualSaleModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [events, setEvents] = useState<Option[]>([]);
  const [tables, setTables] = useState<Option[]>([]);
  const [types, setTypes] = useState<TicketType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [event, setEvent] = useState("");
  const [kind, setKind] = useState("ticket");
  const [table, setTable] = useState("");
  const [product, setProduct] = useState("");
  const [type, setType] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    reservationId: string;
    ticketId: string;
    emailStatus?: string;
  } | null>(null);
  const [received, setReceived] = useState(false);
  const [buyer, setBuyer] = useState({
    full_name: "",
    doc_type: "dni",
    document: "",
    email: "",
    phone: "",
    payment_method: "cash",
    reference: "",
    notes: "",
  });
  const request = useRef<{ fingerprint: string; id: string } | null>(null);
  async function read(path: string) {
    const response = await authedFetch(path);
    const data = await response.json();
    if (!response.ok || !data.success)
      throw new Error(data.error || "No se pudieron cargar las opciones.");
    return data;
  }
  useEffect(() => {
    if (!isOpen) return;
    let live = true;
    read("/api/admin/events")
      .then((data) => {
        if (live) setEvents(data.events);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [isOpen]);
  useEffect(() => {
    setTables([]);
    setTypes([]);
    setTable("");
    setProduct("");
    setType("");
    setProducts([]);
    if (!event || !isOpen) return;
    let live = true;
    setLoading(true);
    setError("");
    Promise.all([
      read(`/api/admin/tables?event_id=${event}`),
      read(`/api/events/${event}/ticket-types`),
    ])
      .then(([tableData, typeData]) => {
        if (live) {
          setTables(tableData.tables);
          setTypes(
            typeData.ticket_types.filter(
              (row: TicketType) => row.is_active && row.price > 0,
            ),
          );
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [event, isOpen]);
  useEffect(() => {
    setProducts([]);
    setProduct("");
    if (!table || !isOpen) return;
    let live = true;
    setLoading(true);
    read(`/api/admin/table-products?table_id=${table}`)
      .then((data) => {
        if (live) setProducts(data.products);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [table, isOpen]);
  if (!isOpen) return null;
  const choice =
    kind === "ticket"
      ? types.find((row) => row.code === type)
      : products.find((row) => row.id === product);
  const packages = kind === "ticket" ? quantity : 1;
  const total = Number(choice?.price || 0) * packages;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!received || !choice || !total) {
      setError("Selecciona el producto y confirma que recibiste el pago.");
      return;
    }
    const payload = {
      ...buyer,
      event_id: event,
      table_id: kind === "table" ? table : null,
      product_id: kind === "table" ? product : null,
      ticket_type_code: kind === "ticket" ? type : null,
      package_quantity: packages,
      expected_amount_cents: Math.round(total * 100),
      received,
    };
    const fingerprint = JSON.stringify(payload);
    if (request.current?.fingerprint !== fingerprint)
      request.current = { fingerprint, id: crypto.randomUUID() };
    setBusy(true);
    setError("");
    try {
      const response = await authedFetch("/api/admin/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, request_id: request.current!.id }),
      });
      const data = await response.json();
      if (!response.ok || !data.success)
        throw new Error(data.error || "No se pudo registrar la venta.");
      setResult(data);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo registrar la venta.",
      );
    } finally {
      setBusy(false);
    }
  }
  function close() {
    if (busy) return;
    if (result) onSuccess();
    onClose();
  }
  const input =
    "mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-base text-white focus:border-red-500 focus:outline-none";
  const label = "block text-sm text-neutral-300";
  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-sale-title"
    >
      <section className="mx-auto my-6 w-full max-w-2xl rounded-2xl border border-neutral-700 bg-neutral-950 p-5 sm:p-7">
        <header className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id="manual-sale-title" className="text-xl font-semibold">
              Registrar venta manual
            </h2>
            <p className="mt-2 text-sm text-neutral-400">
              Registra un cobro ya recibido. No se realiza un cargo a través de
              Mercado Pago.
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar venta manual"
            disabled={busy}
            onClick={close}
            className="p-2 text-white"
          >
            ✕
          </button>
        </header>
        {result ? (
          <div className="space-y-5">
            <p className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-200">
              Venta pagada registrada. El QR del comprador está emitido; los
              acompañantes se completan desde la reserva.
            </p>
            <p className="text-sm text-neutral-300">
              {result.emailStatus === "sent"
                ? "Correo con el QR enviado al comprador."
                : result.emailStatus === "failed"
                  ? "La venta está guardada. Revisa el correo del comprador y utiliza Reenviar correo desde el detalle."
                  : "La venta está guardada. El correo con el QR está pendiente y se reintentará automáticamente."}
            </p>
            <Link
              className="block rounded-lg bg-red-600 p-3 text-center font-semibold text-white"
              href={`/admin/tickets/${result.ticketId}`}
            >
              Ver entrada del comprador
            </Link>
            <button
              type="button"
              onClick={close}
              className="w-full rounded-lg border border-neutral-600 p-3"
            >
              Volver a las ventas
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset disabled={busy} className="space-y-4 disabled:opacity-60">
              <label className={label}>
                Evento
                <select
                  required
                  value={event}
                  onChange={(e) => setEvent(e.target.value)}
                  className={input}
                >
                  <option value="">Selecciona un evento</option>
                  {events.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={label}>
                Tipo de venta
                <select
                  value={kind}
                  onChange={(e) => {
                    setKind(e.target.value);
                    setQuantity(1);
                  }}
                  className={input}
                >
                  <option value="ticket">Entradas</option>
                  <option value="table">Mesa / Box</option>
                </select>
              </label>
              {kind === "ticket" ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_100px]">
                  <label className={label}>
                    Entrada
                    <select
                      required
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className={input}
                    >
                      <option value="">Selecciona la entrada</option>
                      {types.map((row) => (
                        <option key={row.code} value={row.code}>
                          {row.label} · {row.ticket_quantity} QR ·{" "}
                          {money(row.price)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Paquetes
                    <input
                      className={input}
                      type="number"
                      min={1}
                      max={10}
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      required
                    />
                  </label>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={label}>
                    Mesa / Box
                    <select
                      required
                      value={table}
                      onChange={(e) => setTable(e.target.value)}
                      className={input}
                    >
                      <option value="">Selecciona una mesa</option>
                      {tables.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={label}>
                    Pack
                    <select
                      required
                      value={product}
                      onChange={(e) => setProduct(e.target.value)}
                      className={input}
                    >
                      <option value="">Selecciona un pack</option>
                      {products.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · {money(Number(row.price))}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              )}
              {loading && (
                <p role="status" className="text-sm text-neutral-400">
                  Cargando disponibilidad…
                </p>
              )}
              <label className={label}>
                Nombre completo
                <input
                  className={input}
                  value={buyer.full_name}
                  onChange={(e) =>
                    setBuyer({ ...buyer, full_name: e.target.value })
                  }
                  required
                  maxLength={150}
                />
              </label>
              <div className="grid grid-cols-[100px_1fr] gap-3">
                <label className={label}>
                  Tipo doc.
                  <select
                    className={input}
                    value={buyer.doc_type}
                    onChange={(e) =>
                      setBuyer({
                        ...buyer,
                        doc_type: e.target.value,
                        document: "",
                      })
                    }
                  >
                    {DOCUMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={label}>
                  Documento
                  <input
                    className={input}
                    value={buyer.document}
                    onChange={(e) =>
                      setBuyer({ ...buyer, document: e.target.value })
                    }
                    required
                    maxLength={20}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={label}>
                  Email
                  <input
                    className={input}
                    type="email"
                    value={buyer.email}
                    onChange={(e) =>
                      setBuyer({ ...buyer, email: e.target.value })
                    }
                    required
                    maxLength={254}
                  />
                </label>
                <label className={label}>
                  Teléfono
                  <input
                    className={input}
                    type="tel"
                    value={buyer.phone}
                    onChange={(e) =>
                      setBuyer({ ...buyer, phone: e.target.value })
                    }
                    maxLength={30}
                  />
                </label>
              </div>
              <label className={label}>
                Medio del cobro recibido
                <select
                  className={input}
                  value={buyer.payment_method}
                  onChange={(e) =>
                    setBuyer({ ...buyer, payment_method: e.target.value })
                  }
                >
                  <option value="cash">Efectivo</option>
                  <option value="yape">Yape recibido directamente</option>
                  <option value="transfer">Transferencia bancaria</option>
                  <option value="card_external">Tarjeta / POS externo</option>
                </select>
              </label>
              <label className={label}>
                Referencia del pago
                {buyer.payment_method === "cash" ? " (opcional)" : ""}
                <input
                  className={input}
                  value={buyer.reference}
                  onChange={(e) =>
                    setBuyer({ ...buyer, reference: e.target.value })
                  }
                  required={buyer.payment_method !== "cash"}
                  maxLength={150}
                  minLength={buyer.payment_method !== "cash" ? 3 : undefined}
                />
              </label>
              <label className={label}>
                Notas (opcional)
                <textarea
                  className={input}
                  value={buyer.notes}
                  onChange={(e) =>
                    setBuyer({ ...buyer, notes: e.target.value })
                  }
                  maxLength={1000}
                />
              </label>
              <div className="flex justify-between rounded-xl border border-neutral-700 p-4">
                <span>Total cobrado</span>
                <strong>{money(total)}</strong>
              </div>
              <label className="flex gap-3 text-sm leading-6 text-neutral-200">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-red-600"
                  checked={received}
                  onChange={(e) => setReceived(e.target.checked)}
                  required
                />
                Confirmo que recibí el importe completo y que estos datos
                corresponden al comprador.
              </label>
              {error && (
                <p role="alert" className="text-sm text-red-300">
                  {error}
                </p>
              )}
              <button
                disabled={busy || loading || !choice || !received}
                className="w-full rounded-xl bg-red-600 p-3 font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {busy
                  ? "Registrando venta…"
                  : "Registrar venta pagada y emitir QR"}
              </button>
            </fieldset>
          </form>
        )}
      </section>
    </div>
  );
}
