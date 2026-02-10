# 📊 DataTable Mejorada con Paginación - Guía de Implementación

## 🚀 Nuevo Sistema de Paginación

### **Componentes Creados:**
- ✅ `usePagination` hook - Manejo inteligente de paginación
- ✅ `Pagination` component - UI profesional de paginación  
- ✅ `ImprovedDataTable` - DataTable con paginación integrada

## 📋 Cómo Implementar en tus Pantallas

### **1. Para Datos Locales (Cliente)**

```tsx
// Ejemplo: Lista de eventos con paginación local
import { ImprovedDataTable } from '@/components/dashboard/ImprovedDataTable';

function EventosPage() {
  const [events, setEvents] = useState(allEvents); // Todos los datos
  const [loading, setLoading] = useState(false);

  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'date', label: 'Fecha' },
    { key: 'status', label: 'Estado' },
    // Campos expandibles (se muestran solo al expandir)
    { key: 'description', label: 'Descripción', expandable: true },
    { key: 'venue', label: 'Ubicación', expandable: true },
    { key: 'capacity', label: 'Capacidad', expandable: true },
  ];

  return (
    <ImprovedDataTable
      data={events}
      columns={columns}
      loading={loading}
      emptyMessage="No hay eventos disponibles"
      visibleColumns={3} // Solo 3 columnas visibles, el resto expandible
      actions={(row) => (
        <>
          <Button size="sm" variant="outline">Editar</Button>
          <Button size="sm" variant="danger">Eliminar</Button>
        </>
      )}
      // Paginación se maneja automáticamente
    />
  );
}
```

### **2. Para Datos del Servidor (BD) - RECOMENDADO**

```tsx
// Ejemplo: Reservas con paginación desde BD
import { ImprovedDataTable } from '@/components/dashboard/ImprovedDataTable';
import { usePagination } from '@repo/ui';

function ReservasPage() {
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Hook de paginación
  const pagination = usePagination({
    initialPageSize: 20,
    pageSizeOptions: [10, 20, 50, 100],
    basePath: '/admin/reservas'
  });

  // Función para cargar datos con paginación
  const loadReservas = async (page: number, pageSize: number) => {
    setLoading(true);
    try {
      // 🔥 Parámetros para BD - BUENAS PRÁCTICAS
      const { offset, limit } = pagination.getDbParams();
      
      // Query SQL equivalente:
      // SELECT * FROM reservas 
      // ORDER BY created_at DESC 
      // LIMIT ${limit} OFFSET ${offset}
      
      const response = await fetch(`/api/admin/reservas?offset=${offset}&limit=${limit}`);
      const { data, total } = await response.json();
      
      setReservas(data);
      setTotalCount(total);
      
      // Actualizar total en hook
      (pagination as any).updateTotal(total);
      
    } catch (error) {
      console.error('Error loading reservas:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos cuando cambie la paginación
  useEffect(() => {
    loadReservas(pagination.pagination.page, pagination.pagination.pageSize);
  }, [pagination.pagination.page, pagination.pagination.pageSize]);

  const columns = [
    { key: 'id', label: 'ID', width: 'w-20' },
    { key: 'customer_name', label: 'Cliente' },
    { key: 'event_name', label: 'Evento' },
    { key: 'status', label: 'Estado' },
    // Campos expandibles
    { key: 'email', label: 'Email', expandable: true },
    { key: 'phone', label: 'Teléfono', expandable: true },
    { key: 'notes', label: 'Notas', expandable: true },
    { key: 'created_at', label: 'Fecha Registro', expandable: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Reservas</h1>
        <Button>Nueva Reserva</Button>
      </div>
      
      <ImprovedDataTable
        data={reservas}
        columns={columns}
        loading={loading}
        emptyMessage="No hay reservas disponibles"
        visibleColumns={4}
        pagination={{
          total: totalCount,
          onPageChange: pagination.setPage,
          onPageSizeChange: pagination.setPageSize,
          pageSizeOptions: [10, 20, 50, 100],
          showPageSizeSelector: true
        }}
        actions={(row) => (
          <>
            <Button size="sm" variant="outline">Ver</Button>
            <Button size="sm" variant="primary">Editar</Button>
          </>
        )}
      />
    </div>
  );
}
```

## 🗄️ Implementación en Base de Datos

### **API Route Example (`/api/admin/reservas/route.ts`)**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // 🔥 BUENAS PRÁCTICAS: Parámetros de paginación
  const offset = parseInt(searchParams.get('offset') || '0');
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100); // Max 100
  const search = searchParams.get('search') || '';
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Query principal con paginación
    let query = supabase
      .from('reservations')
      .select(\`
        *,
        events(name),
        customers(name, email)
      \`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtro de búsqueda si existe
    if (search) {
      query = query.or(\`
        customer_name.ilike.%\${search}%,
        events.name.ilike.%\${search}%
      \`);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Count total (sin paginación) - IMPORTANTE para UI
    const { count, error: countError } = await supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;

    return NextResponse.json({
      data,
      total: count || 0,
      offset,
      limit
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Error loading reservations' },
      { status: 500 }
    );
  }
}
```

### **SQL Queries Equivalentes**

```sql
-- 🔥 BUENAS PRÁCTICAS: Paginación eficiente

-- 1. Query principal con LIMIT/OFFSET
SELECT 
  r.*,
  e.name as event_name,
  c.name as customer_name,
  c.email as customer_email
FROM reservations r
LEFT JOIN events e ON r.event_id = e.id
LEFT JOIN customers c ON r.customer_id = c.id
ORDER BY r.created_at DESC
LIMIT 20 OFFSET 0;

-- 2. Count total (para UI de paginación)
SELECT COUNT(*) as total FROM reservations;

-- 3. Con filtro de búsqueda
SELECT r.*, e.name as event_name
FROM reservations r
LEFT JOIN events e ON r.event_id = e.id
WHERE 
  r.customer_name ILIKE '%search%' 
  OR e.name ILIKE '%search%'
ORDER BY r.created_at DESC
LIMIT 20 OFFSET 0;
```

## 📱 Implementación en Pantallas del Backoffice

### **1. Usuarios (`/admin/users`)**

```tsx
// apps/backoffice/app/admin/users/page.tsx
'use client';

import { ImprovedDataTable } from '@/components/dashboard/ImprovedDataTable';
import { usePagination, Badge } from '@repo/ui';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const pagination = usePagination({
    initialPageSize: 25,
    basePath: '/admin/users'
  });

  const columns = [
    { key: 'name', label: 'Nombre' },
    { key: 'email', label: 'Email' },
    { 
      key: 'role', 
      label: 'Rol',
      render: (role) => <Badge variant={role === 'admin' ? 'success' : 'secondary'}>{role}</Badge>
    },
    // Expandibles
    { key: 'phone', label: 'Teléfono', expandable: true },
    { key: 'last_login', label: 'Último Acceso', expandable: true },
    { key: 'created_at', label: 'Fecha Registro', expandable: true },
  ];

  return (
    <ImprovedDataTable
      data={users}
      columns={columns}
      loading={loading}
      pagination={{
        total: users.length, // Obtener de BD
        onPageChange: pagination.setPage,
        onPageSizeChange: pagination.setPageSize,
      }}
    />
  );
}
```

### **2. Eventos (`/admin/events`)**

```tsx
// apps/backoffice/app/admin/events/page.tsx
const columns = [
  { key: 'name', label: 'Evento' },
  { key: 'date', label: 'Fecha' },
  { 
    key: 'status', 
    label: 'Estado',
    render: (status) => <Badge variant={status === 'active' ? 'success' : 'warning'}>{status}</Badge>
  },
  // Expandibles
  { key: 'description', label: 'Descripción', expandable: true },
  { key: 'venue', label: 'Ubicación', expandible: true },
  { key: 'capacity', label: 'Capacidad', expandible: true },
  { key: 'price', label: 'Precio', expandible: true },
];
```

### **3. Reservas (`/admin/reservations`)**

```tsx
// apps/backoffice/app/admin/reservations/page.tsx
const columns = [
  { key: 'id', label: 'ID', width: 'w-16' },
  { key: 'customer_name', label: 'Cliente' },
  { key: 'event_name', label: 'Evento' },
  { 
    key: 'status', 
    label: 'Estado',
    render: (status) => {
      const variants = {
        confirmed: 'success',
        pending: 'warning', 
        cancelled: 'error'
      };
      return <Badge variant={variants[status]}>{status}</Badge>;
    }
  },
  // Expandibles
  { key: 'email', label: 'Email', expandible: true },
  { key: 'phone', label: 'Teléfono', expandible: true },
  { key: 'guests', label: 'Invitados', expandible: true },
];
```

## ✅ Beneficios del Nuevo Sistema

### **🚀 Performance**
- Paginación en BD (no carga todos los registros)
- Lazy loading de datos
- Queries optimizadas con LIMIT/OFFSET

### **🎨 UX Mejorada**
- Navegación fluida entre páginas
- Selector de tamaño de página
- Información clara de resultados
- Loading states

### **💻 DX (Developer Experience)**
- Hook reutilizable `usePagination`
- API consistent entre pantallas
- TypeScript completo
- Configuración flexible

### **📱 Responsive**
- Mobile-first design
- Versión compacta automática
- Touch-friendly controls

## 🔧 Configuración Rápida por Pantalla

Para aplicar a cualquier pantalla del backoffice:

1. **Importar** componentes necesarios
2. **Configurar** columnas (visibles + expandibles)
3. **Implementar** carga de datos con paginación
4. **Usar** `ImprovedDataTable` con props de paginación

**¡Tu DataTable ahora es 10x más profesional y eficiente!** 🎉