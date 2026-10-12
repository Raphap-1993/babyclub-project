"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import { evaluateEventSales } from "shared/eventSales";
import TableMap from "../registro/TableMap";
import { buildMapSlotsFromTables } from "../registro/tableSlotUtils";
import type { HomeEvent } from "./eventModel";
import styles from "./eventDetail.module.css";
type Product = {
  id: string;
  name: string;
  description?: string;
  price: number | null;
  tickets_included: number | null;
  is_active: boolean;
  deleted_at?: string | null;
};
type Space = {
  id: string;
  name: string;
  ticket_count: number;
  price: number | null;
  is_reserved: boolean;
  products: Product[];
  layout_x?: number;
  layout_y?: number;
  layout_size?: number;
};
type Layout = {
  layout_url: string | null;
  canvas_width: number | null;
  canvas_height: number | null;
};
export default function EventTables({
  event,
  onEntries,
}: {
  event: HomeEvent;
  onEntries: () => void;
}) {
  const [tables, setTables] = useState<Space[]>([]),
    [layout, setLayout] = useState<Layout | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading"),
    [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState(""),
    [productId, setProductId] = useState("");
  const [imageSize, setImageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  useEffect(() => {
    setImageSize(null);
    if (!layout?.layout_url) return;
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight)
        setImageSize({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
    };
    image.src = layout.layout_url;
    return () => {
      image.onload = null;
    };
  }, [layout?.layout_url]);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setSelectedId("");
    setProductId("");
    setTables([]);
    setLayout(null);
    const params = new URLSearchParams({ event_id: event.id });
    Promise.all([
      fetch(`/api/tables?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch(`/api/layout?${params}`, {
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([tr, lr]) => {
        const [t, l] = await Promise.all([tr.json(), lr.json()]);
        if (
          !tr.ok ||
          !lr.ok ||
          t.error ||
          l.error ||
          t.warning ||
          l.warning ||
          !Array.isArray(t.tables)
        )
          throw new Error("unavailable");
        if (!controller.signal.aborted) {
          setTables(t.tables);
          setLayout(l);
          setState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [event.id, attempt]);
  const sale = evaluateEventSales(event);
  const selected = tables.find((t) => t.id === selectedId && !t.is_reserved);
  const products = (selected?.products || []).filter(
    (p) => p.is_active !== false && !p.deleted_at,
  );
  const product = products.find((p) => p.id === productId);
  const canvas =
    layout?.canvas_width && layout?.canvas_height
      ? { width: layout.canvas_width, height: layout.canvas_height }
      : null;
  const slots = buildMapSlotsFromTables(tables, {
    canvasWidth: canvas?.width,
    canvasHeight: canvas?.height,
  });
  const choose = (id: string) => {
    const t = tables.find((t) => t.id === id && !t.is_reserved);
    if (!t) return;
    setSelectedId(id);
    setProductId(
      t.products?.find((p) => p.is_active !== false && !p.deleted_at)?.id || "",
    );
  };
  const price = product?.price ?? selected?.price;
  const canContinue =
    sale.available &&
    selected &&
    (!products.length || product) &&
    price != null &&
    Number.isFinite(Number(price)) &&
    Number(price) >= 0;
  return (
    <>
      <section
        className={styles.mapExperience}
        aria-label="Croquis de mesas y boxes"
      >
        <p className={styles.eyebrow}>{event.name}</p>
        <h1>Elige tu lugar en BABY</h1>
        <p className={styles.tableIntro}>
          Selecciona tu mesa o box directamente en el croquis.
        </p>
        <div className={styles.mapLegend}>
          <span>○ Disponible</span>
          <span>● Seleccionado</span>
          <span>○ Reservado</span>
        </div>
        {state === "loading" && <p role="status">Cargando croquis…</p>}
        {state === "error" && (
          <div role="status">
            <p>No pudimos cargar el croquis.</p>
            <button
              className={styles.continue}
              onClick={() => setAttempt((n) => n + 1)}
            >
              Volver a intentar
            </button>
          </div>
        )}
        {state === "ready" &&
          (layout?.layout_url ? (
            <div className={styles.mapCanvas}>
              <TableMap
                slots={slots}
                selectedTableId={selectedId}
                onSelect={choose}
                layoutUrl={layout.layout_url}
                viewBoxOverride={canvas}
                imageNaturalSize={imageSize}
                loading={false}
                enableZoom={false}
                labelMode="number"
                minSlotSizePx={0}
                minSlotScreenPx={24}
                focusOnSlots
              />
            </div>
          ) : (
            <p className={styles.unavailable}>
              El croquis de este evento aún no está configurado.
            </p>
          ))}
      </section>
      <section className={styles.selection} aria-label="Reserva de mesa o box">
        <p className={styles.experienceTitle}>Elige tu experiencia</p>
        <div
          className={styles.experienceSwitch}
          role="group"
          aria-label="Tipo de experiencia"
        >
          <button onClick={onEntries} aria-pressed={false}>
            Entradas
          </button>
          <button aria-pressed={true}>Mesas y boxes</button>
        </div>
        <h2>Tu reserva</h2>
        {!sale.available ? (
          <p className={styles.unavailable}>
            {sale.public_message ||
              "Las reservas no están disponibles para este evento."}
          </p>
        ) : (
          <>
            {state === "ready" && layout?.layout_url && (
              <label className={styles.spacePicker}>
                Ubicación
                <select
                  value={selectedId}
                  onChange={(e) => choose(e.target.value)}
                >
                  <option value="">Elige en el croquis o aquí</option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.is_reserved}>
                      Espacio {t.name}
                      {t.is_reserved ? " · reservado" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {selected ? (
              <>
                <p className={styles.tableIntro}>
                  <Users size={16} aria-hidden="true" />{" "}
                  {product?.tickets_included ?? selected.ticket_count} entradas
                  incluidas
                </p>
                {products.length > 0 && (
                  <fieldset className={styles.options}>
                    <legend className={styles.tableIntro}>
                      Elige tu paquete
                    </legend>
                    {products.map((p) => (
                      <label
                        key={p.id}
                        className={`${styles.option} ${p.id === productId ? styles.selected : ""}`}
                      >
                        <input
                          type="radio"
                          name="mesa-product"
                          checked={p.id === productId}
                          onChange={() => setProductId(p.id)}
                        />
                        <span className={styles.optionText}>
                          <strong>{p.name}</strong>
                          {p.description && <span>{p.description}</span>}
                        </span>
                      </label>
                    ))}
                  </fieldset>
                )}
                <div className={styles.summary}>
                  <div>
                    <strong>Total</strong>
                    <strong>
                      {price != null
                        ? `S/ ${new Intl.NumberFormat("es-PE").format(Number(price))}`
                        : "Por confirmar"}
                    </strong>
                  </div>
                </div>
                {canContinue && (
                  <Link
                    className={styles.continue}
                    href={`/compra?${new URLSearchParams({ event_id: event.id, tab: "mesa", table_id: selected.id, ...(product ? { product_id: product.id } : {}) })}`}
                  >
                    Continuar reserva{" "}
                    <ArrowRight size={20} aria-hidden="true" />
                  </Link>
                )}
                <p className={styles.next}>
                  Tus datos y el pago, en el siguiente paso.
                </p>
              </>
            ) : (
              <p className={styles.tableIntro}>
                Toca una ubicación disponible para ver sus paquetes y precio.
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
