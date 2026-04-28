import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const VALID_STATUSES = new Set([
  "draft",
  "pending",
  "paid",
  "delivered",
  "closed",
  "void",
]);

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> } | { params: { id: string } },
) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json(
      { success: false, error: guard.error },
      { status: guard.status },
    );
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 },
    );
  }

  const params = await context.params;
  const id = asString(params?.id);
  const body = await req.json().catch(() => ({}));
  const status = asString(body?.status);
  if (!id) {
    return NextResponse.json(
      { success: false, error: "id requerido" },
      { status: 400 },
    );
  }
  if (!VALID_STATUSES.has(status)) {
    return NextResponse.json(
      { success: false, error: "status inválido" },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const payload: Record<string, unknown> = {
    status,
    updated_at: now,
  };
  if (["paid", "delivered", "closed"].includes(status)) {
    payload.settled_by_staff_id = guard.context?.staffId || null;
    payload.settled_at = now;
  }
  if (status === "void") {
    payload.voided_by_staff_id = guard.context?.staffId || null;
    payload.voided_at = now;
    payload.is_active = false;
    payload.deleted_at = now;
    payload.deleted_by = guard.context?.staffId || null;
  }
  if (typeof body?.notes === "string") {
    payload.notes = body.notes.trim() || null;
  }

  const { data, error } = await supabase
    .from("promoter_settlements")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 400 },
    );
  }

  if (status === "void") {
    await supabase
      .from("promoter_settlement_items")
      .update({
        is_active: false,
        deleted_at: now,
        deleted_by: guard.context?.staffId || null,
        updated_at: now,
      })
      .eq("settlement_id", id);
  }

  return NextResponse.json({ success: true, settlement: data });
}
