import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PromoterActions from "./components/PromoterActions";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Promoter = {
  id: string;
  code: string | null;
  is_active: boolean | null;
  person: {
    id: string;
    dni: string | null;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
  };
};

async function getPromoters(): Promise<{ promoters: Promoter[]; error?: string }> {
  if (!supabaseUrl || !supabaseServiceKey) return { promoters: [], error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await supabase
    .from("promoters")
    .select("id,code,is_active,person:persons(id,dni,first_name,last_name,email,phone)")
    .order("created_at", { ascending: true });
  if (error || !data) return { promoters: [], error: error?.message || "No se pudieron cargar promotores" };

  const normalized: Promoter[] = (data as any[]).map((p) => {
    const personRel = Array.isArray(p.person) ? p.person[0] : p.person;
    return {
      id: p.id,
      code: p.code ?? null,
      is_active: p.is_active ?? null,
      person: {
        id: personRel?.id ?? "",
        dni: personRel?.dni ?? null,
        first_name: personRel?.first_name ?? "",
        last_name: personRel?.last_name ?? "",
        email: personRel?.email ?? null,
        phone: personRel?.phone ?? null,
      },
    };
  });

  return { promoters: normalized };
}

export const dynamic = "force-dynamic";

export default async function PromotersPage() {
  const { promoters, error } = await getPromoters();

  return (
    <main className="min-h-screen bg-black px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f2f2]/60">Promotores</p>
          <h1 className="text-3xl font-semibold">Listado de promotores</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex items-center justify-center rounded-full border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:border-white"
          >
            ← Volver
          </Link>
          <Link
            href="/admin/promoters/create"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-[#e91e63] to-[#ff77b6] px-5 py-2 text-sm font-semibold text-white shadow-[0_12px_35px_rgba(233,30,99,0.35)] transition hover:shadow-[0_14px_38px_rgba(233,30,99,0.45)]"
          >
            Crear promotor
          </Link>
        </div>
      </div>

      <div className="hidden overflow-x-auto rounded-3xl border border-white/10 bg-[#0c0c0c] shadow-[0_20px_80px_rgba(0,0,0,0.45)] lg:block">
        <table className="min-w-full table-fixed divide-y divide-white/10 text-sm">
          <thead className="bg-white/[0.02] text-xs uppercase tracking-[0.08em] text-white/60">
            <tr>
              <th className="w-[24%] px-4 py-3 text-left">Nombre</th>
              <th className="w-[13%] px-4 py-3 text-left">DNI</th>
              <th className="w-[22%] px-4 py-3 text-left">Email</th>
              <th className="w-[13%] px-4 py-3 text-left">Código</th>
              <th className="w-[14%] px-4 py-3 text-left">Estado</th>
              <th className="w-[14%] px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {promoters.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-white/60">
                  {error ? `Error: ${error}` : "No hay promotores aún."}
                </td>
              </tr>
            )}
            {promoters.map((promoter) => (
              <tr key={promoter.id} className="hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-semibold text-white">
                  {promoter.person.first_name} {promoter.person.last_name}
                </td>
                <td className="px-4 py-3 text-white/80">{promoter.person.dni || "—"}</td>
                <td className="px-4 py-3 text-white/80 break-words">{promoter.person.email || "—"}</td>
                <td className="px-4 py-3 text-white/80">{promoter.code || "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                      promoter.is_active
                        ? "bg-[#e91e63]/15 text-[#e91e63]"
                        : "bg-white/5 text-white/70"
                    }`}
                  >
                    {promoter.is_active ? "Activo" : "Inactivo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <PromoterActions id={promoter.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {promoters.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 text-center text-white/70">
            {error ? `Error: ${error}` : "No hay promotores aún."}
          </div>
        )}
        {promoters.map((promoter) => (
          <div
            key={promoter.id}
            className="rounded-2xl border border-white/10 bg-[#0c0c0c] p-4 shadow-[0_12px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-white">
                  {promoter.person.first_name} {promoter.person.last_name}
                </p>
                {promoter.person.email && <p className="text-sm text-white/70">{promoter.person.email}</p>}
                {promoter.person.phone && <p className="text-xs text-white/60">{promoter.person.phone}</p>}
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                  promoter.is_active ? "bg-[#e91e63]/15 text-[#e91e63]" : "bg-white/5 text-white/70"
                }`}
              >
                {promoter.is_active ? "Activo" : "Inactivo"}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-white/80">
              <Info label="DNI" value={promoter.person.dni || "—"} />
              <Info label="Código" value={promoter.code || "—"} />
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <PromoterActions id={promoter.id} />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.12em] text-white/50">{label}</p>
      <p className="font-semibold text-white">{value}</p>
    </div>
  );
}
