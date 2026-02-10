import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 🔥 HELPER: Validar y sanitizar parámetros de paginación
function getPaginationParams(searchParams: URLSearchParams) {
  // Offset (desde qué registro empezar)
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0'));
  
  // Limit (cuántos registros traer) - Máximo 100 por seguridad
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25')));
  
  // Parámetros opcionales de filtrado
  const search = searchParams.get('search')?.trim() || '';
  const status = searchParams.get('status')?.trim() || '';
  const eventId = searchParams.get('event_id')?.trim() || '';
  
  // Ordenamiento
  const sortBy = searchParams.get('sort_by') || 'created_at';
  const sortOrder = searchParams.get('sort_order') === 'asc' ? 'asc' : 'desc';
  
  return {
    offset,
    limit,
    search,
    status,
    eventId,
    sortBy,
    sortOrder
  };
}

// 🚀 API ENDPOINT: /api/admin/reservations/list
export async function GET(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Configuración de Supabase incompleta' },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { searchParams } = new URL(request.url);
    const { offset, limit, search, status, eventId, sortBy, sortOrder } = getPaginationParams(searchParams);

    // 🔥 QUERY PRINCIPAL: Con joins optimizados y filtros
    let query = supabase
      .from('table_reservations')
      .select(\`
        id,
        full_name,
        email,
        phone,
        status,
        codes,
        ticket_quantity,
        created_at,
        updated_at,
        table:tables(name, event:events(name)),
        event:event_id(name)
      \`, { count: 'exact' }) // count: 'exact' para obtener total
      .order(sortBy, { ascending: sortOrder === 'asc' });

    // 🔍 APLICAR FILTROS
    
    // Filtro de búsqueda (nombre, email, teléfono)
    if (search) {
      query = query.or(\`
        full_name.ilike.%\${search}%,
        email.ilike.%\${search}%,
        phone.ilike.%\${search}%
      \`);
    }
    
    // Filtro de estado
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Filtro por evento específico
    if (eventId) {
      query = query.eq('event_id', eventId);
    }

    // 🚀 APLICAR PAGINACIÓN
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching reservations:', error);
      return NextResponse.json(
        { success: false, error: 'Error al obtener reservas' },
        { status: 500 }
      );
    }

    // 🔄 NORMALIZAR DATOS (igual que el código original)
    const normalized = (data || []).map((res: any) => {
      const tableRel = Array.isArray(res.table) ? res.table[0] : res.table;
      const eventRel = tableRel?.event ? (Array.isArray(tableRel.event) ? tableRel.event[0] : tableRel.event) : null;
      const eventFallback = Array.isArray(res.event) ? res.event[0] : res.event;
      
      return {
        id: res.id,
        full_name: res.full_name ?? '',
        email: res.email ?? null,
        phone: res.phone ?? null,
        status: res.status ?? '',
        codes: res.codes ?? null,
        ticket_quantity: typeof res.ticket_quantity === 'number' ? res.ticket_quantity : null,
        table_name: tableRel?.name ?? 'Entrada',
        event_name: eventRel?.name ?? eventFallback?.name ?? '—',
        created_at: res.created_at,
        updated_at: res.updated_at,
      };
    });

    // 📊 RESPUESTA CON METADATA DE PAGINACIÓN
    return NextResponse.json({
      success: true,
      data: normalized,
      pagination: {
        total: count || 0,
        offset,
        limit,
        page: Math.floor(offset / limit) + 1,
        totalPages: Math.ceil((count || 0) / limit),
        hasNext: offset + limit < (count || 0),
        hasPrev: offset > 0,
      },
      filters: {
        search,
        status,
        eventId,
        sortBy,
        sortOrder,
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// 🔥 OPCIONAL: Endpoint para obtener estadísticas rápidas
export async function POST(request: NextRequest) {
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json(
      { success: false, error: 'Configuración de Supabase incompleta' },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Obtener estadísticas de estados
    const { data: stats } = await supabase
      .from('table_reservations')
      .select('status')
      .not('status', 'is', null);

    const statusCounts = (stats || []).reduce((acc: Record<string, number>, item: any) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      stats: {
        total: stats?.length || 0,
        byStatus: statusCounts,
      }
    });

  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Error al obtener estadísticas' },
      { status: 500 }
    );
  }
}