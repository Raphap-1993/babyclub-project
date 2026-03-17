import { NextRequest, NextResponse } from "next/server";
import { Client } from "pg";
import { requireStaffRole } from "shared/auth/requireStaff";
import { getResendClient } from "shared/email/resend";

// Respetado en Vercel Pro; en free se ignora (cap 10s)
export const maxDuration = 60;

// Orden respetando dependencias de FK
const TABLES = [
  "organizers",
  "persons",
  "staff",
  "promoters",
  "events",
  "tables",
  "codes",
  "code_batches",
  "tickets",
  "table_reservations",
] as const;

function escapeSqlValue(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(v);
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function tableToSql(tableName: string, rows: Record<string, unknown>[]): string {
  if (!rows.length) return `-- (sin registros)\n`;

  const columns = Object.keys(rows[0])
    .map((c) => `"${c}"`)
    .join(", ");

  const valueRows = rows
    .map((row) => `  (${Object.values(row).map(escapeSqlValue).join(", ")})`)
    .join(",\n");

  return `INSERT INTO "${tableName}" (${columns}) VALUES\n${valueRows};\n`;
}

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req, ["admin", "superadmin"]);
  if (!guard.ok) {
    return NextResponse.json({ error: guard.error }, { status: guard.status });
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json(
      { error: "DATABASE_URL no configurado. Agrégala en las variables de entorno de Vercel." },
      { status: 500 },
    );
  }

  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
    statement_timeout: 30000,
  });

  try {
    await client.connect();

    const results = await Promise.all(
      TABLES.map(async (table) => {
        try {
          const { rows } = await client.query(
            `SELECT * FROM "${table}" ORDER BY created_at DESC LIMIT 50000`,
          );
          return { table, rows: rows as Record<string, unknown>[], error: null };
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          return { table, rows: [] as Record<string, unknown>[], error: msg };
        }
      }),
    );

    const totalRows = results.reduce((acc, r) => acc + r.rows.length, 0);
    const now = new Date();
    const ts = now.toISOString();

    // Generar SQL
    const lines: string[] = [
      `-- ============================================================`,
      `-- BabyClub — Backup de Base de Datos`,
      `-- Generado: ${ts}`,
      `-- Por: ${guard.context?.staffId ?? "unknown"}`,
      `-- Tablas: ${results.length} | Filas totales: ${totalRows.toLocaleString()}`,
      `-- ============================================================`,
      ``,
      `-- Para restaurar:`,
      `--   1. Abre el SQL Editor en Supabase Dashboard`,
      `--   2. Pega el contenido de este archivo`,
      `--   3. Ejecuta (las FK checks están deshabilitadas durante el proceso)`,
      `--`,
      `-- O con psql:`,
      `--   psql "[connection-string]" < este_archivo.sql`,
      ``,
      `SET session_replication_role = replica; -- deshabilita FK checks`,
      ``,
    ];

    for (const { table, rows, error } of results) {
      lines.push(`-- ────────────────────────────────────────`);
      lines.push(`-- Tabla: ${table} (${rows.length.toLocaleString()} filas)${error ? ` ⚠ ERROR: ${error}` : ""}`);
      lines.push(`-- ────────────────────────────────────────`);
      lines.push(tableToSql(table, rows));
    }

    lines.push(`SET session_replication_role = DEFAULT; -- restaura FK checks`);
    lines.push(``);
    lines.push(`-- Fin del backup — ${ts}`);

    const sql = lines.join("\n");
    const tsFile = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}`;
    const filename = `backup_babyclub_${tsFile}.sql`;

    const emailParam = req.nextUrl.searchParams.get("email");

    // === Email mode ===
    if (emailParam) {
      try {
        const resend = getResendClient();
        const dateLabel = now.toLocaleDateString("es-PE", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        await resend.emails.send({
          from: process.env.RESEND_FROM ?? "BabyClub Access <no-reply@babyclubaccess.com>",
          to: emailParam,
          subject: `Backup BD BabyClub — ${dateLabel}`,
          html: `
            <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
              <h2 style="color:#e91e63">Backup de Base de Datos</h2>
              <p>Se adjunta el backup SQL completo generado el <strong>${dateLabel}</strong>.</p>
              <table style="border-collapse:collapse;width:100%;margin:16px 0">
                <tr style="background:#f5f5f5">
                  <td style="padding:8px 12px;font-weight:600">Tablas exportadas</td>
                  <td style="padding:8px 12px">${results.length}</td>
                </tr>
                <tr>
                  <td style="padding:8px 12px;font-weight:600">Total de filas</td>
                  <td style="padding:8px 12px">${totalRows.toLocaleString("es-PE")}</td>
                </tr>
                <tr style="background:#f5f5f5">
                  <td style="padding:8px 12px;font-weight:600">Formato</td>
                  <td style="padding:8px 12px">SQL (restaurable con psql o Supabase SQL Editor)</td>
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
              content: Buffer.from(sql).toString("base64"),
            },
          ],
        } as any);

        return NextResponse.json({
          success: true,
          message: `Backup enviado a ${emailParam}`,
          tables: results.length,
          rows: totalRows,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Error al enviar el email";
        return NextResponse.json({ error: msg }, { status: 500 });
      }
    }

    // === Download mode ===
    return new NextResponse(sql, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "X-Backup-Tables": String(results.length),
        "X-Backup-Rows": String(totalRows),
        "Cache-Control": "no-store",
      },
    });
  } finally {
    await client.end().catch(() => null);
  }
}
