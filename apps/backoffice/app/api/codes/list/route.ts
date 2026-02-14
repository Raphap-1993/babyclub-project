import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

function toIso(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { searchParams } = new URL(req.url);
  const event_id = searchParams.get("event_id") || "";
  const type = searchParams.get("type") || "";
  const promoter_id = searchParams.get("promoter_id") || "";
  const status = (searchParams.get("status") || "all") as "all" | "active" | "inactive" | "expired";
  const batch_id = searchParams.get("batch_id") || "";
  const format = searchParams.get("format") || "json";
  const view = (searchParams.get("view") || "codes") as "codes" | "lots";

  const start_date = toIso(searchParams.get("start_date"));
  const end_date = toIso(searchParams.get("end_date"));

  if (!event_id) {
    return NextResponse.json({ success: false, error: "event_id es requerido" }, { status: 400 });
  }

  const page = clamp(parseInt(searchParams.get("page") || "1", 10) || 1, 1, 100000);
  const pageSize = clamp(parseInt(searchParams.get("pageSize") || "50", 10) || 50, 1, 500);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const selectColumns =
    "id,code,type,event_id,promoter_id,is_active,max_uses,uses,expires_at,created_at,batch_id,event:events(name),promoter:promoters(code,person:persons(first_name,last_name))";
  const nowIso = new Date().toISOString();
  function applyFilters<T>(query: T & any) {
    if (type) query = query.eq("type", type);
    if (promoter_id) query = query.eq("promoter_id", promoter_id);
    if (batch_id) query = query.eq("batch_id", batch_id);
    if (start_date) query = query.gte("created_at", start_date);
    if (end_date) query = query.lte("created_at", end_date);
    if (status === "active") {
      query = query.eq("is_active", true).or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    } else if (status === "inactive") {
      query = query.eq("is_active", false);
    } else if (status === "expired") {
      query = query.lt("expires_at", nowIso);
    }
    return query;
  }

  function mapRows(data: any[] | null | undefined) {
    return (data || []).map((c) => ({
      id: c.id,
      code: c.code,
      type: c.type,
      event_id: c.event_id,
      event_name: Array.isArray(c.event) ? c.event?.[0]?.name : c.event?.name,
      promoter_id: c.promoter_id,
      promoter_code: Array.isArray(c.promoter) ? c.promoter?.[0]?.code : c.promoter?.code,
      promoter_name: (() => {
        const p = Array.isArray(c.promoter) ? c.promoter?.[0] : c.promoter;
        const person = Array.isArray(p?.person) ? p?.person?.[0] : p?.person;
        const full = [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim();
        return full || null;
      })(),
      is_active: c.is_active,
      max_uses: c.max_uses,
      uses: c.uses,
      expires_at: c.expires_at,
      created_at: c.created_at,
      batch_id: c.batch_id,
    }));
  }

  if (view === "lots" && format !== "csv") {
    const chunkSize = 1000;
    const hardLimit = 10000;
    let offset = 0;
    const allData: any[] = [];

    while (offset < hardLimit) {
      let chunkQuery = applyNotDeleted(
        supabase
          .from("codes")
          .select(selectColumns)
          .eq("event_id", event_id)
          .order("created_at", { ascending: false })
          .range(offset, offset + chunkSize - 1),
      );
      chunkQuery = applyFilters(chunkQuery);

      const { data, error } = await chunkQuery;
      if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      }

      const batch = data || [];
      allData.push(...batch);
      if (batch.length < chunkSize) break;
      offset += chunkSize;
    }

    const rows = mapRows(allData);
    const grouped = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = row.batch_id || "no-batch";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(row);
    }

    const groups = Array.from(grouped.entries())
      .map(([groupBatchId, groupRows]) => ({
        batchId: groupBatchId,
        createdAt: groupRows[0]?.created_at || "",
        rows: groupRows.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const pagedGroups = groups.slice(from, to + 1);
    const pagedRows = pagedGroups.flatMap((group) => group.rows);

    return NextResponse.json({
      success: true,
      data: pagedRows,
      total: groups.length,
      total_codes: rows.length,
      mode: "lots",
    });
  }

  let query = applyNotDeleted(
    supabase
      .from("codes")
      .select(selectColumns, { count: "exact" })
      .eq("event_id", event_id)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  query = applyFilters(query);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  const rows = mapRows(data as any[]);

  if (format === "csv") {
    const headers = [
      "code",
      "type",
      "event_id",
      "event_name",
      "promoter_id",
      "promoter_code",
      "promoter_name",
      "is_active",
      "uses",
      "max_uses",
      "expires_at",
      "created_at",
      "batch_id",
    ];
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        [
          r.code,
          r.type,
          r.event_id,
          r.event_name || "",
          r.promoter_id || "",
          r.promoter_code || "",
          r.promoter_name || "",
          r.is_active ? "1" : "0",
          r.uses ?? 0,
          r.max_uses ?? "",
          r.expires_at || "",
          r.created_at || "",
          r.batch_id || "",
        ]
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(","),
      ),
    ].join("\n");

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": "attachment; filename=codes.csv",
      },
    });
  }

  return NextResponse.json({ success: true, data: rows, total: count ?? rows.length });
}
