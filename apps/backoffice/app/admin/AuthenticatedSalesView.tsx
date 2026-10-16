"use client";
import { useEffect, useState } from "react";
import { authedFetch } from "@/lib/authedFetch";
import ModernReservationsClient from "./reservations/ModernReservationsClient";
import ModernTicketsClient from "./tickets/ModernTicketsClient";
import TicketDetailView from "./tickets/TicketDetailView";

export default function AuthenticatedSalesView({
  view,
  params = {},
}: {
  view: "reservations" | "tickets" | "ticket";
  params?: Record<string, string>;
}) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener("baby-sales-updated", refresh);
    return () => window.removeEventListener("baby-sales-updated", refresh);
  }, []);
  const query = new URLSearchParams({ ...params, view }).toString();
  useEffect(() => {
    let active = true;
    setData(null);
    setError("");
    authedFetch("/api/admin/sales-view?" + query, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "No se pudieron cargar las ventas.");
        if (active) setData(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [query, revision]);
  if (error)
    return (
      <p
        role="alert"
        className="rounded-xl border border-red-500/30 p-5 text-red-300"
      >
        {error}
      </p>
    );
  if (!data)
    return (
      <p role="status" className="p-5 text-sm text-neutral-400">
        Verificando sesión y cargando datos…
      </p>
    );
  if (view === "reservations")
    return (
      <ModernReservationsClient
        initialReservations={data.reservations}
        error={data.error || null}
      />
    );
  if (view === "tickets")
    return (
      <ModernTicketsClient
        initialTickets={data.tickets}
        error={data.error}
        filters={data.filters}
        promoterOptions={data.promoterOptions}
        eventOptions={data.eventOptions}
      />
    );
  return (
    <TicketDetailView id={params.id} ticket={data.ticket} error={data.error} />
  );
}
