"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  CheckCircle2,
  CreditCard,
  FlaskConical,
  History,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { authedFetch } from "@/lib/authedFetch";
import type { MercadoPagoSalesControl } from "shared/payments/mercadopagoSalesControl";

type Panel = {
  environment: "test" | "live";
  control: MercadoPagoSalesControl;
  provider: {
    environment: string;
    configured: boolean;
    enabled: boolean;
  } | null;
  history: {
    id: number;
    paused: boolean;
    version: number;
    created_at: string;
    staff_id: string;
  }[];
  testUrl: string;
  testPanelUrl: string;
};
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(new Date(value));

export default function MercadoPagoPage() {
  const [panel, setPanel] = useState<Panel | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setConfirming(false);
    try {
      const response = await authedFetch("/api/admin/mercadopago", {
        cache: "no-store",
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || "No se pudo cargar el panel.");
      setPanel(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el panel.",
      );
      setPanel(null);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  async function changeSales() {
    if (!panel || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await authedFetch("/api/admin/mercadopago", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paused: !panel.control.paused,
          version: panel.control.version,
        }),
      });
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || "No se pudo guardar el cambio.");
      setMessage(
        json.control.paused
          ? "Ventas pausadas. Los pagos en curso seguirán procesándose."
          : "Ventas reanudadas.",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar el cambio.",
      );
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  }
  const live = panel?.environment === "live";
  const card =
    "rounded-2xl border border-neutral-800 bg-neutral-950 p-5 sm:p-6";
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-xs uppercase tracking-[0.18em] text-neutral-500">
            Sistema / Pagos
          </p>
          <h1 className="flex items-center gap-3 text-2xl font-semibold">
            <CreditCard className="text-sky-400" size={27} />
            Mercado Pago
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Control de ventas de entradas, mesas y boxes.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading || saving}
          className="flex items-center gap-2 rounded-xl border border-neutral-700 px-4 py-2.5 text-sm disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200"
        >
          {message}
        </p>
      )}
      {loading && !panel && (
        <p
          role="status"
          className="flex items-center gap-2 py-8 text-neutral-400"
        >
          <Loader2 size={18} className="animate-spin" />
          Consultando la integración…
        </p>
      )}
      {panel && (
        <>
          <section
            className={`${card} flex flex-wrap items-start justify-between gap-4`}
            aria-label="Modo activo"
          >
            <div>
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${live ? "bg-emerald-500/10 text-emerald-300" : "bg-amber-500/10 text-amber-200"}`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {live ? "PRODUCCIÓN" : "PRUEBAS LOCALES"}
              </span>
              <h2 className="mt-4 text-xl font-semibold">
                {live
                  ? "Pagos reales en BABY"
                  : "Un entorno separado para probar"}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-neutral-400">
                {live
                  ? "Este panel administra la web pública. El acceso a pruebas se abre por separado y no cambia su modo."
                  : "Las compras, los correos y los QR de este entorno utilizan la base local de la laptop."}
              </p>
            </div>
            <p className="flex items-center gap-2 text-sm text-neutral-300">
              <ShieldCheck size={18} className="text-sky-400" />
              Acceso exclusivo de administradores
            </p>
          </section>
          <div className="grid gap-5 md:grid-cols-2">
            <section className={card} aria-label="Estado de ventas">
              <p className="text-xs uppercase tracking-wider text-neutral-500">
                Nuevas compras
              </p>
              <h2 className="mt-3 text-xl font-semibold">
                {panel.control.paused
                  ? "Ventas pausadas"
                  : panel.provider?.enabled
                    ? "Ventas activas"
                    : "Ventas no disponibles"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                La pausa se aplica a entradas y mesas. Los pagos ya enviados,
                los QR emitidos y las reservas existentes conservan su
                funcionamiento.
              </p>
              {!panel.provider && (
                <p className="mt-3 text-sm text-amber-200">
                  No se pudo verificar la conexión con la web. Actualiza el
                  panel para consultar su estado.
                </p>
              )}
              {panel.provider && !panel.provider.configured && (
                <p className="mt-3 text-sm text-amber-200">
                  La integración está deshabilitada en el servidor. Reanudar
                  ventas aquí no activa credenciales.
                </p>
              )}
              <button
                disabled={saving || loading}
                onClick={() => {
                  setConfirming(true);
                  setMessage("");
                }}
                className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${panel.control.paused ? "bg-white text-black" : "border border-rose-500/40 bg-rose-500/10 text-rose-200"}`}
              >
                {panel.control.paused ? (
                  <Play size={16} />
                ) : (
                  <Pause size={16} />
                )}
                {panel.control.paused ? "Reanudar ventas" : "Pausar ventas"}
              </button>
              <p className="mt-3 text-xs text-neutral-500">
                Control actualizado: {formatTime(panel.control.updated_at)} ·
                Lima
              </p>
              {confirming && (
                <div
                  role="group"
                  aria-label="Confirmar cambio de ventas"
                  className="mt-4 rounded-xl border border-neutral-700 bg-black p-4"
                >
                  <p className="text-sm">
                    {panel.control.paused
                      ? "Se permitirán nuevas compras"
                      : "Se pausarán las nuevas compras"}{" "}
                    en{" "}
                    <strong>{live ? "producción" : "pruebas locales"}</strong>.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      onClick={changeSales}
                      disabled={saving}
                      className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                    >
                      {saving
                        ? "Guardando…"
                        : panel.control.paused
                          ? "Confirmar reanudación"
                          : "Confirmar pausa"}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={saving}
                      className="px-3 py-2 text-sm text-neutral-400"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </section>
            <section className={card} aria-label="Entorno de pruebas">
              <FlaskConical className="mb-3 text-sky-400" size={23} />
              <h2 className="text-xl font-semibold">
                Probar sin afectar a clientes
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-400">
                Usa las tarjetas de prueba de Mercado Pago. Los datos y QR de
                prueba se guardan únicamente en esta laptop.
              </p>
              <a
                href={panel.testUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 flex items-center justify-between rounded-xl border border-neutral-700 px-4 py-3 text-sm font-semibold"
              >
                Abrir web de pruebas
                <ArrowUpRight size={17} />
              </a>
              <a
                href={panel.testPanelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex items-center justify-between px-1 py-2 text-sm text-sky-300"
              >
                Abrir panel de pruebas
                <ArrowUpRight size={16} />
              </a>
              <p className="mt-3 text-xs leading-5 text-neutral-500">
                Requiere Docker y el proyecto local encendidos. En otra
                computadora, estos enlaces apuntan a su propio entorno local. La
                sesión del backoffice de pruebas es independiente.
              </p>
            </section>
          </div>
          <section className={card} aria-label="Historial de cambios">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <History size={18} className="text-neutral-400" />
              Actividad del control de ventas
            </h2>
            {panel.history.length ? (
              <ul className="mt-4 divide-y divide-neutral-800">
                {panel.history.map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                  >
                    <span className="flex items-center gap-2">
                      {item.paused ? (
                        <Pause size={15} className="text-amber-300" />
                      ) : (
                        <CheckCircle2 size={15} className="text-emerald-300" />
                      )}
                      {item.paused ? "Ventas pausadas" : "Ventas reanudadas"}
                      <span className="text-xs text-neutral-500">
                        · Administrador {item.staff_id.slice(0, 8)}
                      </span>
                    </span>
                    <time className="text-xs text-neutral-500">
                      {formatTime(item.created_at)}
                    </time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-neutral-500">
                Todavía no hay cambios de estado.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
