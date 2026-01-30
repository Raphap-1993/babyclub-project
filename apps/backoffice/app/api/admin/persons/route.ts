import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeDocument, validateDocument, type DocumentType } from "shared/document";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

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
  const docTypeRaw = (searchParams.get("doc_type") || "dni") as DocumentType;
  const documentRaw = searchParams.get("document") || searchParams.get("dni") || "";
  const { docType, document } = normalizeDocument(docTypeRaw, documentRaw);
  const dni = docType === "dni" ? document : "";
  const email = (searchParams.get("email") || "").trim();
  const phone = (searchParams.get("phone") || "").trim();

  if (!document && !email && !phone) {
    return NextResponse.json({ success: false, error: "document/email/phone requerido" }, { status: 400 });
  }
  if (document && !validateDocument(docType, document)) {
    return NextResponse.json({ success: false, error: "Documento inválido" }, { status: 400 });
  }

  let query = supabase.from("persons").select("id,doc_type,document,dni,first_name,last_name,email,phone").limit(1);
  const ors: string[] = [];
  if (document) {
    if (docType === "dni") ors.push(`document.eq.${document},dni.eq.${document}`);
    else ors.push(`document.eq.${document}`);
  }
  if (email) ors.push(`email.eq.${email}`);
  if (phone) ors.push(`phone.eq.${phone}`);
  if (ors.length > 0) query = query.or(ors.join(",")).order("created_at", { ascending: false });

  const { data, error } = await query.maybeSingle();
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  if (data) {
    return NextResponse.json({ success: true, person: data });
  }

  // fallback API Peru/RENIEC
  if (dni) {
    try {
      const res = await fetch(`${req.nextUrl.origin}/api/reniec?dni=${dni}`, { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (res.ok && payload) {
        return NextResponse.json({
          success: true,
          person: {
            id: null,
            dni,
            first_name: payload?.nombres || "",
            last_name: `${payload?.apellidoPaterno || ""} ${payload?.apellidoMaterno || ""}`.trim(),
            email: null,
            phone: null,
          },
          source: "reniec",
        });
      }
    } catch (_err) {
      // ignore
    }
  }

  return NextResponse.json({ success: false, error: "No encontrado" }, { status: 404 });
}
