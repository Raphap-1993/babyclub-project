import { NextRequest, NextResponse } from "next/server";
import { requireStaffRole } from "shared/auth/requireStaff";
import { getReservations } from "../../../admin/reservations/reservationData";
import { getAdminTicketList } from "../../../admin/tickets/ticketData";
import { getTicket } from "../../../admin/tickets/ticketDetailData";

export async function GET(req: NextRequest) {
  const headers = {
    "Cache-Control": "private, no-store",
    Vary: "Authorization",
  };
  const guard = await requireStaffRole(req);
  if (!guard.ok)
    return NextResponse.json(
      { error: guard.error },
      { status: guard.status, headers },
    );
  const params = Object.fromEntries(req.nextUrl.searchParams);
  let result;
  if (params.view === "reservations") result = await getReservations();
  else if (params.view === "tickets") result = await getAdminTicketList(params);
  else if (params.view === "ticket" && /^[a-f0-9-]{36}$/i.test(params.id || ""))
    result = await getTicket(params.id);
  else
    return NextResponse.json(
      { error: "Vista inválida." },
      { status: 400, headers },
    );
  return NextResponse.json(result, { headers });
}
