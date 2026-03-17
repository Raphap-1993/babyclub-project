import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { getResendClient } from "shared/email/resend";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const TABLES = [
  "organizers",
  "events",
  "tickets",
  "codes",
  "code_batches",
  "promoters",
  "persons",
  "staff",
  "tables",
  "table_reservations",
] as const;

const ROW_LIMIT = 10_000;

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const emailParam = req.nextUrl.searchParams.get("email");

  // Fetch all tables in parallel
  const results = await Promise.all(
    TABLES.map(async (table) => {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .limit(ROW_LIMIT)
        .order("created_at", { ascending: false });

      return {
        table,
        rows: error ? [] : (data ?? []),
        error: error?.message ?? null,
      };
    }),
  );

  const totalRows = results.reduce((acc, r) => acc + r.rows.length, 0);

  const backup = {
    generated_at: new Date().toISOString(),
    generated_by: guard.context?.staffId ?? "unknown",
    version: "1.0",
    tables: Object.fromEntries(
      results.map((r) => [
        r.table,
        { count: r.rows.length, rows: r.rows, error: r.error },
      ]),
    ),
  };

  const json = JSON.stringify(backup, null, 2);

  // === Email mode ===
  if (emailParam) {
    try {
      const resend = getResendClient();
      const now = new Date();
      const dateLabel = now.toLocaleDateString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const filename = `backup_babyclub_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}.json`;

      await resend.emails.send({
        from: process.env.RESEND_FROM ?? "BabyClub Access <no-reply@babyclubaccess.com>",
        to: emailParam,
        subject: `Backup BD BabyClub — ${dateLabel}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
            <h2 style="color:#e91e63">Backup de Base de Datos</h2>
            <p>Se adjunta el backup completo generado el <strong>${dateLabel}</strong>.</p>
            <table style="border-collapse:collapse;width:100%;margin:16px 0">
              <tr style="background:#f5f5f5">
                <td style="padding:8px 12px;font-weight:600">Tablas exportadas</td>
                <td style="padding:8px 12px">${results.length}</td>
              </tr>
              <tr>
                <td style="padding:8px 12px;font-weight:600">Total de filas</td>
                <td style="padding:8px 12px">${totalRows.toLocaleString("es-PE")}</td>
              </tr>
            </table>
            <p style="font-size:12px;color:#666">
              Este archivo contiene datos personales y sensibles. Manéjalo con cuidado.
            </p>
          </div>
        `,
        attachments: [
          {
            filename,
            content: Buffer.from(json).toString("base64"),
          },
        ],
      } as any);

      return NextResponse.json({
        success: true,
        message: `Backup enviado a ${emailParam}`,
        tables: results.length,
        rows: totalRows,
      });
    } catch (err: any) {
      return NextResponse.json(
        { error: err?.message || "Error al enviar el email" },
        { status: 500 },
      );
    }
  }

  // === Download mode ===
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;

  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="backup_babyclub_${ts}.json"`,
      "X-Backup-Tables": String(results.length),
      "X-Backup-Rows": String(totalRows),
      "Cache-Control": "no-store",
    },
  });
}
