"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { LegalFooterLinks } from "../legal/LegalFooterLinks";
import {
  eventPresentation,
  formatEventDate,
  sortHomeEvents,
  type HomeEvent,
} from "./eventModel";
import styles from "./home.module.css";

const COVER = "/images/baby-home-cover.jpg";

function EventCard({ event }: { event: HomeEvent }) {
  const presentation = eventPresentation(event);
  const date = formatEventDate(event.starts_at);
  const [poster, setPoster] = useState(event.cover_image || COVER);
  return (
    <article className={styles.card}>
      <img
        className={styles.poster}
        src={poster}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => {
          if (poster !== COVER) setPoster(COVER);
        }}
      />
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <time dateTime={date.iso} className={styles.date}>
            {date.label}
          </time>
          <span className={styles.status}>{presentation.status}</span>
        </div>
        <h3>{event.name || "Evento BABY"}</h3>
        {event.location && <p className={styles.venue}>{event.location}</p>}
        {presentation.price && (
          <p className={styles.price}>{presentation.price}</p>
        )}
        {!presentation.canBuy && presentation.message && (
          <p className={styles.saleMessage}>{presentation.message}</p>
        )}
        <Link
          className={styles.details}
          href={`/eventos/${encodeURIComponent(event.id)}`}
          aria-label={`Ver detalles de ${event.name || "Evento BABY"}`}
        >
          Ver detalles <ChevronRight size={22} aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}

export default function HomeClient({
  initialLogoUrl,
}: {
  initialLogoUrl: string | null;
}) {
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [logo, setLogo] = useState(initialLogoUrl || "/images/baby-logo.png");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
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
        const realEvents = data.events.filter(
          (event: HomeEvent) =>
            event && typeof event.id === "string" && event.id,
        );
        if (!controller.signal.aborted) {
          setEvents(sortHomeEvents(realEvents));
          setState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setState("error");
      });
    return () => controller.abort();
  }, [attempt]);

  return (
    <main className={styles.home}>
      <a href="#eventos" className={styles.skip}>
        Ir a los eventos
      </a>
      <section className={styles.hero} aria-label="Bienvenido a BABY">
        <img
          className={styles.heroImage}
          src={COVER}
          alt=""
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className={styles.heroShade} />
        <img
          className={styles.logo}
          src={logo}
          alt="BABY"
          width={240}
          height={80}
          onError={() => {
            if (logo !== "/images/baby-logo.png")
              setLogo("/images/baby-logo.png");
          }}
        />
        <h1 className={styles.headline}>
          baby,
          <br />
          ya estás
          <br />
          aquí...
        </h1>
      </section>
      <section
        className={styles.events}
        id="eventos"
        aria-labelledby="eventos-title"
      >
        <h2 id="eventos-title">Eventos</h2>
        <div aria-live="polite" aria-busy={state === "loading"}>
          {state === "loading" && (
            <p className={styles.notice}>Cargando eventos…</p>
          )}
          {state === "error" && (
            <div className={styles.notice}>
              <p>No pudimos cargar los eventos. Inténtalo nuevamente.</p>
              <button
                className={styles.retry}
                onClick={() => setAttempt((value) => value + 1)}
              >
                Volver a intentar
              </button>
            </div>
          )}
          {state === "ready" && events.length === 0 && (
            <p className={styles.notice}>
              Pronto anunciaremos los próximos eventos. Vuelve a visitarnos.
            </p>
          )}
        </div>
        {state === "ready" && (
          <div className={styles.list}>
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>
      <footer className={styles.footer}>
        <p className={styles.copyright}>
          © {new Date().getFullYear()} BABY CLUB. Todos los derechos
          reservados.
        </p>
        <nav className={styles.accessLinks} aria-label="Tus entradas y códigos">
          <Link href="/mis-entradas">Mis entradas</Link>
          <Link href="/codigo">¿Tienes un código?</Link>
        </nav>
        <LegalFooterLinks compact className={styles.legal} />
      </footer>
    </main>
  );
}
