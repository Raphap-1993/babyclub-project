import PromotersClient from "./PromotersClient";
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Promoter = {
  id: string;
  code: string | null;
  person_id?: string;
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

async function getPromoters(params: { page: number; pageSize: number; q?: string }) {
  if (!supabaseUrl || !supabaseServiceKey) return { promoters: [], total: 0, error: "Falta configuración de Supabase" };
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const start = (params.page - 1) * params.pageSize;
  const end = start + params.pageSize - 1;

  let query = supabase
    .from("promoters")
    .select("id,code,person_id,is_active,person:persons!inner(id,dni,first_name,last_name,email,phone)", {
      count: "exact",
    })
    .order("created_at", { ascending: true })
    .range(start, end);

  if (params.q) {
    const term = params.q.trim();
    if (term) {
      // buscar coincidencias de persona primero
      const { data: personsMatch } = await supabase
        .from("persons")
        .select("id")
        .or(
          [
            `first_name.ilike.%${term}%`,
            `last_name.ilike.%${term}%`,
            `dni.ilike.%${term}%`,
            `email.ilike.%${term}%`,
          ].join(",")
        );
      const personIds = (personsMatch || []).map((p: any) => p.id).filter(Boolean);

      const ors = [`code.ilike.%${term}%`];
      if (personIds.length > 0) {
        ors.push(`person_id.in.(${personIds.join(",")})`);
      }
      query = query.or(ors.join(","));
    }
  }

  const { data, error, count } = await query;
  if (error || !data) return { promoters: [], total: 0, error: error?.message || "No se pudieron cargar promotores" };

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

  return { promoters: normalized, total: count ?? normalized.length };
}

export const dynamic = "force-dynamic";

export default async function PromotersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = Math.max(1, parseInt((params?.page as string) || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(5, parseInt((params?.pageSize as string) || "10", 10) || 10));
  const q = (params?.q as string) || "";

  const { promoters, error, total } = await getPromoters({ page, pageSize, q });
  if (!promoters && error) return notFound();

  // Si el total real es mayor que la página actual, ajustamos totalPages en el cliente con total; aquí sólo pasamos los datos de la página.
  return (
    <PromotersClient
      promoters={promoters || []}
      error={error || null}
      pagination={{ page, pageSize, q }}
      total={total}
    />
  );
}
