import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase config missing:', { 
      hasUrl: !!supabaseUrl, 
      hasKey: !!supabaseServiceKey 
    });
    return NextResponse.json(
      { success: false, error: "Supabase config missing" },
      { status: 500 }
    );
  }

  const searchParams = req.nextUrl.searchParams;
  const dni = searchParams.get("dni");
  
  console.log('📋 DNI param:', dni);

  if (!dni || dni.trim().length === 0) {
    return NextResponse.json(
      { success: false, error: "DNI is required" },
      { status: 400 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    console.log('🔎 Querying persons table for DNI:', dni.trim());
    
    // Buscar en la tabla persons por DNI
    const { data, error } = await supabase
      .from("persons")
      .select("id, dni, first_name, last_name, email, phone")
      .eq("dni", dni.trim())
      .limit(1);

    if (error) {
      console.error("❌ Supabase error:", error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    console.log('📊 Query result:', { found: !!data?.length, count: data?.length });

    if (!data || data.length === 0) {
      console.log('❌ No person found for DNI:', dni);
      return NextResponse.json(
        { success: true, person: null },
        { status: 200 }
      );
    }

    console.log('✅ Person found for DNI:', dni, 'Data:', data[0]);
    return NextResponse.json(
      { success: true, person: data[0] },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("❌ Unexpected error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
