import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireStaffRole } from "shared/auth/requireStaff";
import { applyNotDeleted, buildArchivePayload } from "shared/db/softDelete";
import { getUserFacingSupabaseError } from "@/lib/supabaseErrors";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSafeApiError(message: unknown, fallback: string) {
  return getUserFacingSupabaseError(message, fallback);
}

// GET - Lista todos los organizadores (incluye inactivos para admin)
export async function GET(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, organizers: [], error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, organizers: [], error: "Supabase config missing" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Para admin, mostramos todos (activos e inactivos)
  const { data, error } = await applyNotDeleted(
    supabase
      .from("organizers")
      .select(`
        id,
        slug,
        name,
        is_active,
        sort_order,
        created_at,
        events:events(count)
      `)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true })
  );

  if (error) {
    return NextResponse.json(
      {
        success: false,
        organizers: [],
        error: getSafeApiError(error?.message, "No se pudieron cargar organizadores"),
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, organizers: data || [] });
}

// POST - Crear nuevo organizador
export async function POST(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { name, slug, is_active } = body;

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: "Nombre y slug son requeridos" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar que el slug no exista
    const { data: existing } = await applyNotDeleted(
      supabase.from("organizers").select("id").eq("slug", slug)
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ success: false, error: "El slug ya existe" }, { status: 400 });
    }

    // Obtener el próximo sort_order automáticamente
    const { data: maxOrder } = await applyNotDeleted(
      supabase
        .from("organizers")
        .select("sort_order")
        .order("sort_order", { ascending: false })
        .limit(1)
    );

    const nextSortOrder = maxOrder && maxOrder.length > 0 ? maxOrder[0].sort_order + 1 : 0;

    // Crear el organizador
    const { data, error } = await supabase
      .from("organizers")
      .insert({
        name: name.trim(),
        slug: slug.toLowerCase().trim(),
        sort_order: nextSortOrder,
        is_active: is_active !== false, // default true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: getSafeApiError(error?.message, "No se pudo crear el organizador") },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, organizer: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
}

// PUT - Actualizar organizador
export async function PUT(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { id, name, slug, sort_order, is_active } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: "ID es requerido" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Si se cambia el slug, verificar que no exista
    if (slug) {
      const { data: existing } = await applyNotDeleted(
        supabase.from("organizers").select("id").eq("slug", slug).neq("id", id)
      );

      if (existing && existing.length > 0) {
        return NextResponse.json({ success: false, error: "El slug ya existe" }, { status: 400 });
      }
    }

    const updateData: any = {};
    if (name) updateData.name = name.trim();
    if (slug) updateData.slug = slug.toLowerCase().trim();
    if (typeof sort_order === 'number') updateData.sort_order = sort_order;
    if (typeof is_active === 'boolean') updateData.is_active = is_active;

    const { data, error } = await supabase
      .from("organizers")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { success: false, error: getSafeApiError(error?.message, "No se pudo actualizar el organizador") },
        { status: 500 }
      );
    }

    if (!data) {
      return NextResponse.json({ success: false, error: "Organizador no encontrado" }, { status: 404 });
    }

    return NextResponse.json({ success: true, organizer: data });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
  }
}

// DELETE - Soft delete de organizador
export async function DELETE(req: NextRequest) {
  const guard = await requireStaffRole(req);
  if (!guard.ok) {
    return NextResponse.json({ success: false, error: guard.error }, { status: guard.status });
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ success: false, error: "Supabase config missing" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ success: false, error: "ID es requerido" }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verificar que no tenga eventos activos
    const { data: eventsCount, error: eventsError } = await supabase
      .from("events")
      .select("id")
      .eq("organizer_id", id)
      .is("deleted_at", null)
      .is("closed_at", null);

    if (eventsError) {
      return NextResponse.json(
        { success: false, error: getSafeApiError(eventsError?.message, "No se pudo validar eventos activos") },
        { status: 500 }
      );
    }

    if (eventsCount && eventsCount.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: "No se puede eliminar: el organizador tiene eventos activos" 
      }, { status: 400 });
    }

    const { error } = await supabase
      .from("organizers")
      .update(buildArchivePayload())
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: getSafeApiError(error?.message, "No se pudo eliminar el organizador") },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }
}
