import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import PromoterCodesClient from "./PromoterCodesClient";
import { AdminHeader, AdminPage, AdminPanel } from "@/components/admin/PageScaffold";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type PromoterData = {
  id: string;
  code: string | null;
  is_active: boolean | null;
  person: {
    first_name: string | null;
    last_name: string | null;
    email: string | null;
    dni: string | null;
  } | null;
};

type EventOption = {
  id: string;
  name: string;
  starts_at: string | null;
  event_prefix: string | null;
};

type BatchItem = {
  id: string;
  event_id: string;
  created_at: string;
  quantity: number;
  prefix: string | null;
  expires_at: string | null;
  is_active: boolean | null;
  event_name: string | null;
  latest_code: string | null;
  preview_codes: string[];
};

function getPromoterDisplayName(promoter: PromoterData) {
  const person = Array.isArray((promoter as any).person)
    ? ((promoter as any).person[0] as PromoterData["person"])
    : promoter.person;
  const fullName = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim();
  return fullName || promoter.code || `Promotor ${promoter.id.slice(0, 8)}`;
}

async function getPageData(id: string): Promise<{
  promoter: PromoterData | null;
  events: EventOption[];
  recentBatches: BatchItem[];
}> {
  if (!supabaseUrl || !supabaseServiceKey) {
    return { promoter: null, events: [], recentBatches: [] };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [promoterRes, eventsRes, batchesRes] = await Promise.all([
    applyNotDeleted(
      supabase
        .from("promoters")
        .select("id,code,is_active,person:persons(first_name,last_name,email,dni)")
        .eq("id", id),
    ).maybeSingle(),
    applyNotDeleted(
      supabase
        .from("events")
        .select("id,name,starts_at,event_prefix")
        .eq("is_active", true)
        .order("starts_at", { ascending: true })
        .limit(300),
    ),
    applyNotDeleted(
      supabase
        .from("code_batches")
        .select("id,event_id,created_at,quantity,prefix,expires_at,is_active,event:events(name)")
        .eq("promoter_id", id)
        .order("created_at", { ascending: false })
        .limit(25),
    ),
  ]);

  const promoterRaw = promoterRes.data || null;
  const promoter = promoterRaw
    ? ({
        id: promoterRaw.id,
        code: promoterRaw.code ?? null,
        is_active: promoterRaw.is_active ?? null,
        person: Array.isArray((promoterRaw as any).person)
          ? ((promoterRaw as any).person[0] ?? null)
          : ((promoterRaw as any).person ?? null),
      } as PromoterData)
    : null;

  const events =
    (eventsRes.data || []).map((event: any) => ({
      id: event.id as string,
      name: event.name as string,
      starts_at: event.starts_at ?? null,
      event_prefix: event.event_prefix ?? null,
    })) || [];

  const batchIds =
    ((batchesRes.data || []) as any[])
      .map((batch: any) => batch.id as string)
      .filter(Boolean) || [];

  const batchCodesRes = batchIds.length
    ? await applyNotDeleted(
        supabase
          .from("codes")
          .select("batch_id,code,created_at")
          .in("batch_id", batchIds)
          .order("created_at", { ascending: false })
          .limit(5000),
      )
    : ({ data: [] as any[] } as { data: any[] });

  const previewByBatch = new Map<string, string[]>();
  (batchCodesRes.data || []).forEach((row: any) => {
    const batchId = typeof row.batch_id === "string" ? row.batch_id : "";
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!batchId || !code) return;
    const current = previewByBatch.get(batchId) || [];
    if (current.includes(code) || current.length >= 5) return;
    previewByBatch.set(batchId, [...current, code]);
  });

  const recentBatches =
    (batchesRes.data || []).map((batch: any) => {
      const eventRel = Array.isArray(batch.event) ? batch.event[0] : batch.event;
      const previewCodes = previewByBatch.get(batch.id as string) || [];
      return {
        id: batch.id as string,
        event_id: batch.event_id as string,
        created_at: batch.created_at as string,
        quantity: Number(batch.quantity || 0),
        prefix: batch.prefix ?? null,
        expires_at: batch.expires_at ?? null,
        is_active: batch.is_active ?? null,
        event_name: eventRel?.name || null,
        latest_code: previewCodes[0] || null,
        preview_codes: previewCodes,
      };
    }) || [];

  return { promoter, events, recentBatches };
}

export const dynamic = "force-dynamic";

export default async function PromoterCodesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { promoter, events, recentBatches } = await getPageData(id);

  if (!promoter) return notFound();

  return (
    <AdminPage>
      <AdminHeader
        kicker="Operaciones / Promotores"
        title="Códigos de cortesía"
        description={`Genera lotes de códigos friendly para ${getPromoterDisplayName(promoter)}.`}
        actions={
          <>
            <Link href="/admin/codes" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
              Ver Códigos
            </Link>
            <Link href="/admin/promoters" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Volver
            </Link>
          </>
        }
      />
      <AdminPanel contentClassName="p-6">
        <PromoterCodesClient promoter={promoter} events={events} recentBatches={recentBatches} />
      </AdminPanel>
    </AdminPage>
  );
}
