import Link from "next/link";
import EventForm from "../components/EventForm";

export const dynamic = "force-dynamic";

export default function CreateEventPage() {
  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Crear</p>
          <h1 className="text-3xl font-semibold">Nuevo evento</h1>
        </div>
        <Link
          href="/admin/events"
          className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
        >
          ← Volver
        </Link>
      </div>
      <EventForm mode="create" />
    </main>
  );
}
