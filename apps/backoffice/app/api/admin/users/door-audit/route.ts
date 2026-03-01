import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";
import { EVENT_TZ } from "shared/datetime";
import { requireStaffRole } from "shared/auth/requireStaff";
import { hasRole } from "shared/auth/roles";
import { applyNotDeleted } from "shared/db/softDelete";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

type DoorStaffUser = {
  id: string;
  auth_user_id: string | null;
  is_active: boolean;
  role_code: string | null;
  role_name: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
};

type ScanActivity = {
  scans_today: number;
  last_scan_at: string | null;
};

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const staffQuery = applyNotDeleted(
    supabase
      .from("staff")
      .select(
        "id,is_active,auth_user_id,created_at,person:persons(first_name,last_name,email,phone),role:staff_roles(code,name)"
      )
      .order("created_at", { ascending: false })
  );
  const { data: staffData, error: staffError } = await staffQuery;

  if (staffError) {
    return NextResponse.json({ success: false, error: staffError.message }, { status: 400 });
  }

  const doorUsers: DoorStaffUser[] =
    (staffData as any[])
      ?.map((staff) => {
        const roleRel = Array.isArray(staff.role) ? staff.role[0] : staff.role;
        const personRel = Array.isArray(staff.person) ? staff.person[0] : staff.person;
        const firstName = typeof personRel?.first_name === "string" ? personRel.first_name : "";
        const lastName = typeof personRel?.last_name === "string" ? personRel.last_name : "";
        const fullName = `${firstName} ${lastName}`.trim();

        return {
          id: staff.id,
          auth_user_id: staff.auth_user_id ?? null,
          is_active: Boolean(staff.is_active),
          role_code: typeof roleRel?.code === "string" ? roleRel.code : null,
          role_name: typeof roleRel?.name === "string" ? roleRel.name : null,
          full_name: fullName || "Sin nombre",
          email: typeof personRel?.email === "string" ? personRel.email : null,
          phone: typeof personRel?.phone === "string" ? personRel.phone : null,
        };
      })
      .filter((staff) => hasRole(staff.role_code, ["door"])) || [];

  const now = DateTime.now().setZone(EVENT_TZ);
  const dayStartIso = now.startOf("day").toUTC().toISO();
  const dayEndIso = now.endOf("day").toUTC().toISO();
  const doorStaffIds = doorUsers.map((staff) => staff.id);

  const scanActivityByStaff = new Map<string, ScanActivity>();
  if (doorStaffIds.length > 0 && dayStartIso && dayEndIso) {
    const { data: scanRows, error: scanError } = await supabase
      .from("scan_logs")
      .select("scanned_by_staff_id,created_at")
      .in("scanned_by_staff_id", doorStaffIds)
      .gte("created_at", dayStartIso)
      .lte("created_at", dayEndIso)
      .order("created_at", { ascending: false });

    if (scanError) {
      return NextResponse.json({ success: false, error: scanError.message }, { status: 400 });
    }

    for (const scan of scanRows || []) {
      const staffId = typeof (scan as any).scanned_by_staff_id === "string" ? (scan as any).scanned_by_staff_id : null;
      if (!staffId) continue;
      const createdAt = typeof (scan as any).created_at === "string" ? (scan as any).created_at : null;
      const current = scanActivityByStaff.get(staffId);
      if (!current) {
        scanActivityByStaff.set(staffId, {
          scans_today: 1,
          last_scan_at: createdAt,
        });
        continue;
      }
      current.scans_today += 1;
      if (!current.last_scan_at || (createdAt && createdAt > current.last_scan_at)) {
        current.last_scan_at = createdAt;
      }
    }
  }

  const users = doorUsers
    .map((staff) => {
      const activity = scanActivityByStaff.get(staff.id);
      const issues: string[] = [];
      if (!staff.is_active) issues.push("Usuario inactivo");
      if (!staff.auth_user_id) issues.push("Sin vínculo auth_user_id");
      if (!staff.email) issues.push("Sin email de contacto");

      return {
        ...staff,
        scans_today: activity?.scans_today ?? 0,
        last_scan_at: activity?.last_scan_at ?? null,
        ready_for_door: issues.length === 0,
        issues,
      };
    })
    .sort((a, b) => {
      if (a.ready_for_door !== b.ready_for_door) return a.ready_for_door ? -1 : 1;
      if (a.scans_today !== b.scans_today) return b.scans_today - a.scans_today;
      return a.full_name.localeCompare(b.full_name);
    });

  const summary = {
    total_door_users: users.length,
    active_door_users: users.filter((staff) => staff.is_active).length,
    ready_door_users: users.filter((staff) => staff.ready_for_door).length,
    users_with_issues: users.filter((staff) => !staff.ready_for_door).length,
    scanned_staff_today: users.filter((staff) => staff.scans_today > 0).length,
    total_scans_today: users.reduce((acc, staff) => acc + staff.scans_today, 0),
  };

  return NextResponse.json({
    success: true,
    data: {
      date: now.toFormat("yyyy-LL-dd"),
      timezone: EVENT_TZ,
      summary,
      users,
    },
  });
}
