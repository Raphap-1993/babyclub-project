# 🚀 Ejemplo de Uso: Componentes Open Source Mejorados

Este archivo demuestra cómo usar los nuevos componentes para mejorar la presentación de BabyClub.

## 1. EventCard Mejorada

```tsx
// En tu página de eventos
import { EventGrid, toast, CommandPalette, useCommandPalette } from '@repo/ui';

const eventsData = [
  {
    id: '1',
    name: 'Fiesta de Cumpleaños Premium',
    description: 'Una celebración inolvidable con entretenimiento incluido',
    image: '/images/evento-1.jpg',
    date: '15 de Marzo, 2026',
    time: '15:00 - 21:00',
    venue: 'Salón Dorado BabyClub',
    location: 'Lima, Miraflores',
    price: 150,
    attendees: 45,
    capacity: 60,
    status: 'active' as const,
    rating: 4.8,
    category: 'Cumpleaños',
    organizer: {
      name: 'BabyClub Team',
      avatar: '/images/avatar-babyclub.jpg'
    }
  },
  // ... más eventos
];

function EventsPage() {
  const { open, setOpen } = useCommandPalette();

  const handleViewDetails = (eventId: string) => {
    // Navegar a detalles
    toast.info(`Abriendo detalles del evento ${eventId}`);
  };

  const handleBuyTicket = (eventId: string) => {
    // Proceder con compra
    toast.success('¡Redirigiendo a la compra!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-teal-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Eventos <span className="text-purple-600">Increíbles</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Descubre las mejores fiestas de cumpleaños y eventos especiales
          </p>
          
          {/* Search shortcut */}
          <div className="mt-6">
            <button 
              onClick={() => setOpen(true)}
              className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              🔍 Buscar eventos... <kbd className="ml-2 text-xs">⌘K</kbd>
            </button>
          </div>
        </header>

        {/* Events Grid */}
        <EventGrid
          events={eventsData}
          onViewDetails={handleViewDetails}
          onBuyTicket={handleBuyTicket}
          className="mb-12"
        />

        {/* Command Palette */}
        <CommandPalette open={open} onOpenChange={setOpen} placeholder="Buscar eventos, ubicaciones...">
          <CommandGroup heading="Eventos Populares">
            <CommandItem>🎂 Fiesta de Cumpleaños Premium</CommandItem>
            <CommandItem>🎈 Celebración Familiar</CommandItem>
            <CommandItem>🎪 Evento Temático</CommandItem>
          </CommandGroup>
          <CommandGroup heading="Ubicaciones">
            <CommandItem>📍 Lima, Miraflores</CommandItem>
            <CommandItem>📍 Lima, San Isidro</CommandItem>
            <CommandItem>📍 Lima, Barranco</CommandItem>
          </CommandGroup>
        </CommandPalette>
      </div>
    </div>
  );
}
```

## 2. Formulario de Reserva con DatePicker

```tsx
import { DatePicker, DateRangePicker, Button, Input, toast } from '@repo/ui';
import { useState } from 'react';

function ReservationForm() {
  const [eventDate, setEventDate] = useState<Date>();
  const [guestCount, setGuestCount] = useState('');
  const [customerName, setCustomerName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!eventDate || !guestCount || !customerName) {
      toast.error('Por favor completa todos los campos');
      return;
    }
    
    toast.success('¡Reserva enviada correctamente!', {
      description: `Evento programado para ${eventDate.toLocaleDateString()}`
    });
  };

  return (
    <div className="max-w-md mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        Reservar Evento
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <Label htmlFor="customer-name">Nombre del Cliente</Label>
          <Input
            id="customer-name"
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Tu nombre completo"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="event-date">Fecha del Evento</Label>
          <DatePicker
            date={eventDate}
            onDateChange={setEventDate}
            placeholder="Selecciona la fecha de tu evento"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="guest-count">Número de Invitados</Label>
          <Input
            id="guest-count"
            type="number"
            value={guestCount}
            onChange={(e) => setGuestCount(e.target.value)}
            placeholder="¿Cuántos invitados esperas?"
            min="1"
            max="100"
            className="mt-1"
          />
        </div>

        <Button type="submit" className="w-full">
          Enviar Reserva
        </Button>
      </form>
    </div>
  );
}
```

## 3. Layout de Dashboard Mejorado

```tsx
import { 
  Card, 
  CardHeader, 
  CardTitle, 
  CardContent, 
  Badge, 
  Button,
  toast 
} from '@repo/ui';
import { Calendar, Users, TrendingUp, DollarSign } from 'lucide-react';

function DashboardPage() {
  const stats = [
    {
      title: 'Eventos Este Mes',
      value: '23',
      change: '+12%',
      trend: 'up',
      icon: Calendar,
      color: 'purple'
    },
    {
      title: 'Clientes Activos',
      value: '1,245',
      change: '+8%',
      trend: 'up',
      icon: Users,
      color: 'teal'
    },
    {
      title: 'Ingresos',
      value: 'S/ 45,230',
      change: '+23%',
      trend: 'up',
      icon: DollarSign,
      color: 'green'
    },
    {
      title: 'Ocupación',
      value: '89%',
      change: '+5%',
      trend: 'up',
      icon: TrendingUp,
      color: 'blue'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dashboard BabyClub
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Resumen de actividades y métricas
            </p>
          </div>
          <Button 
            onClick={() => toast.success('Datos actualizados')}
            variant="outline"
          >
            🔄 Actualizar
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        {stat.title}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">
                        {stat.value}
                      </p>
                    </div>
                    <div className={`p-3 rounded-full bg-${stat.color}-100 dark:bg-${stat.color}-900`}>
                      <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <Badge variant="success" className="text-xs">
                      {stat.change} vs mes anterior
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Recent Events */}
        <Card>
          <CardHeader>
            <CardTitle>Eventos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1,2,3].map((i) => (
                <div key={i} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
                      🎂
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Cumpleaños de Sofia
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        15 Mar 2026 • 20 invitados
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">Confirmado</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

## 4. Configurar Toast en Layout Principal

```tsx
// apps/backoffice/app/layout.tsx o apps/landing/app/layout.tsx
import { Toaster } from '@repo/ui';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        {/* Agregar Toaster al final */}
        <Toaster />
      </body>
    </html>
  );
}
```

## ✨ Beneficios de Esta Implementación

1. **100% Open Source** - No hay costos de licencia
2. **Profesional** - Componentes con animaciones y microinteracciones
3. **Accesible** - Basado en Radix UI con soporte ARIA
4. **Responsive** - Mobile-first design
5. **Performante** - Tree-shaking automático
6. **Customizable** - Mantiene tu branding (colores purple/teal)

## 🚀 Próximos Pasos

1. Implementar estos ejemplos en tu landing page
2. Migrar páginas del backoffice una por una
3. Agregar más componentes según necesidades específicas
4. A/B test de conversión