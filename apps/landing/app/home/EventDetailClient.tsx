"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  MapPin,
  Minus,
  Plus,
} from "lucide-react";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";
import {
  eventPresentation,
  formatEventDate,
  type HomeEvent,
} from "./eventModel";
import home from "./home.module.css";
import styles from "./eventDetail.module.css";
import EventTables from "./EventTables";
const money = (value: number) =>
  `S/ ${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value)}`;
export default function EventDetailClient({ eventId }: { eventId: string }) {
  const [event, setEvent] = useState<HomeEvent | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "error">(
    "loading",
  );
  const [attempt, setAttempt] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  const [selectedCode, setSelectedCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [experience, setExperience] = useState<"ticket" | "mesa">("ticket");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    setEvent(null);
    setPosterFailed(false);
    setSelectedCode("");
    setQuantity(1);
    fetch("/api/events", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (
          !response.ok ||
          data.error ||
          data.warning ||
          !Array.isArray(data.events)
        )
          throw new Error("events_unavailable");
        const selected = data.events.find(
          (item: HomeEvent) => item?.id === eventId,
        );
        if (!controller.signal.aborted) {
          setEvent(selected || null);
          setState(selected ? "ready" : "missing");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [eventId, attempt]);
  const presentation = event ? eventPresentation(event) : null;
  const options = (event?.ticket_types || []).filter(
    (type) =>
      type.isActive &&
      Number.isFinite(type.price) &&
      type.price > 0 &&
      Number.isInteger(type.ticketQuantity) &&
      type.ticketQuantity > 0 &&
      (!type.currencyCode || type.currencyCode === "PEN"),
  );
  const selected =
    options.find((type) => type.code === selectedCode) || options[0];
  const units = (selected?.ticketQuantity || 0) * quantity;
  const total = (Math.round((selected?.price || 0) * 100) * quantity) / 100;
  const date = formatEventDate(event?.starts_at);
  const purchaseUrl =
    selected && event
      ? `/compra?${new URLSearchParams({ event_id: event.id, tab: "ticket", ticket_type_code: selected.code, package_quantity: String(quantity) })}`
      : "";
  return (
    <main className={`${home.home} ${styles.page}`}>
      <div className={styles.container}>
        <header className={styles.header}>
          <Link href="/" aria-label="BABY, inicio">
            <img
              src="/images/baby-logo.png"
              alt="BABY"
              width={140}
              height={44}
            />
          </Link>
          <Link href="/#eventos" className={styles.back}>
            <ArrowLeft size={18} aria-hidden="true" /> Volver a eventos
          </Link>
        </header>
        <div aria-live="polite" aria-busy={state === "loading"}>
          {state === "loading" && (
            <p className={home.notice}>Cargando evento…</p>
          )}
          {state === "missing" && (
            <div className={home.notice}>
              <h1>Evento no disponible</h1>
              <p>Puedes consultar los eventos disponibles en el inicio.</p>
            </div>
          )}
          {state === "error" && (
            <div className={home.notice}>
              <h1>No pudimos cargar el evento</h1>
              <p>Inténtalo nuevamente en unos momentos.</p>
              <button
                className={home.retry}
                onClick={() => setAttempt((value) => value + 1)}
              >
                Volver a intentar
              </button>
            </div>
          )}
        </div>
        {state === "ready" && event && presentation && (
          <article className={styles.grid}>
            {experience === "mesa" ? (
              <EventTables
                event={event}
                onEntries={() => setExperience("ticket")}
              />
            ) : (
              <>
                <div className={styles.experience}>
                  <img
                    className={styles.poster}
                    src={
                      !posterFailed && event.cover_image
                        ? event.cover_image
                        : "/images/baby-home-cover.jpg"
                    }
                    alt=""
                    loading="eager"
                    decoding="async"
                    onError={() => setPosterFailed(true)}
                  />
                  <h1>{event.name || "Evento BABY"}</h1>
                  <div className={styles.meta}>
                    <p>
                      <CalendarDays size={22} aria-hidden="true" />
                      <time dateTime={date.iso}>{date.label}</time>
                    </p>
                    {event.location && (
                      <p>
                        <MapPin size={22} aria-hidden="true" />
                        {event.location}
                      </p>
                    )}
                  </div>
                  {event.public_description && (
                    <p className={styles.description}>
                      {event.public_description}
                    </p>
                  )}
                  <p className={styles.conditions}>
                    Mayores de 18 años · Presenta tu documento al ingresar.
                  </p>
                </div>
                <section
                  className={styles.selection}
                  aria-label="Compra de entradas y reservas"
                >
                  <p className={styles.experienceTitle}>Elige tu experiencia</p>
                  <div
                    className={styles.experienceSwitch}
                    role="group"
                    aria-label="Tipo de experiencia"
                  >
                    <button
                      type="button"
                      aria-pressed={experience === "ticket"}
                      onClick={() => setExperience("ticket")}
                    >
                      Entradas
                    </button>
                    <button
                      type="button"
                      aria-pressed={false}
                      onClick={() => setExperience("mesa")}
                    >
                      Mesas y boxes
                    </button>
                  </div>
                  {
                    <>
                      <h2 id="ticket-heading">Elige tus entradas</h2>
                      {presentation.canBuy && selected ? (
                        <>
                          <fieldset className={styles.options}>
                            <legend className={styles.srOnly}>
                              Tipo de entrada
                            </legend>
                            {options.map((type) => (
                              <div
                                key={type.id || type.code}
                                className={`${styles.option} ${selected.code === type.code ? styles.selected : ""}`}
                              >
                                <label className={styles.optionChoice}>
                                  <input
                                    type="radio"
                                    name="event-ticket-type"
                                    value={type.code}
                                    checked={selected.code === type.code}
                                    onChange={() => setSelectedCode(type.code)}
                                  />
                                  <span className={styles.optionText}>
                                    <strong>{type.label}</strong>
                                    <span>
                                      {type.ticketQuantity}{" "}
                                      {type.ticketQuantity === 1
                                        ? "persona"
                                        : "personas"}
                                    </span>
                                  </span>
                                  <strong className={styles.price}>
                                    {money(type.price)}
                                  </strong>
                                </label>
                                {selected.code === type.code && (
                                  <div
                                    className={styles.stepper}
                                    role="group"
                                    aria-label={`Cantidad ${type.ticketQuantity > 1 ? "de packs " : "de entradas "}${type.label}`}
                                  >
                                    <button
                                      type="button"
                                      aria-label="Reducir cantidad"
                                      disabled={quantity === 1}
                                      onClick={() =>
                                        setQuantity((value) =>
                                          Math.max(1, value - 1),
                                        )
                                      }
                                    >
                                      <Minus size={18} />
                                    </button>
                                    <output aria-label="Cantidad seleccionada">
                                      {quantity}
                                    </output>
                                    <button
                                      type="button"
                                      aria-label="Aumentar cantidad"
                                      disabled={quantity === 10}
                                      onClick={() =>
                                        setQuantity((value) =>
                                          Math.min(10, value + 1),
                                        )
                                      }
                                    >
                                      <Plus size={18} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </fieldset>
                          <div
                            className={styles.summary}
                            aria-live="polite"
                            aria-atomic="true"
                          >
                            <p>
                              {units} {units === 1 ? "entrada" : "entradas"}
                            </p>
                            <div>
                              <strong>Total</strong>
                              <strong>{money(total)}</strong>
                            </div>
                          </div>
                          <Link href={purchaseUrl} className={styles.continue}>
                            Continuar compra{" "}
                            <ArrowRight size={20} aria-hidden="true" />
                          </Link>
                          <p className={styles.next}>
                            Tus datos y el pago, en el siguiente paso.
                          </p>
                        </>
                      ) : (
                        <div className={styles.unavailable}>
                          <strong>{presentation.status}</strong>
                          <p>
                            {presentation.message ||
                              "Las entradas aún no están disponibles para la compra online."}
                          </p>
                        </div>
                      )}
                    </>
                  }
                </section>
              </>
            )}
          </article>
        )}
      </div>
      <footer className={styles.footer}>
        <p>© {new Date().getFullYear()} BABY CLUB</p>
        <nav className={styles.access} aria-label="Tus entradas y códigos">
          <Link href="/mis-entradas">Mis entradas</Link>
          <Link href="/codigo">¿Tienes un código?</Link>
        </nav>
        <LegalFooterLinks compact className={styles.legal} />
      </footer>
    </main>
  );
}
