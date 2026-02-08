/**
 * Ejemplo completo: Formulario de Login con Validación
 * Demuestra integración de @repo/ui con react-hook-form + zod
 * 
 * Ubicación: apps/backoffice/app/auth/login/page.tsx (REFERENCIA)
 */

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  cn,
} from '@repo/ui';

// 1. Define schema de validación con Zod
const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email es requerido')
    .email('Email inválido'),
  password: z
    .string()
    .min(1, 'Contraseña es requerida')
    .min(6, 'Contraseña debe tener al menos 6 caracteres'),
});

type LoginFormData = z.infer<typeof loginSchema>;

// 2. Componente de formulario
export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  // 3. Setup react-hook-form con validación Zod
  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur', // Valida solo al perder focus
  });

  // 4. Handler de submit
  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setServerError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error en login');
      }

      // Redirigir a dashboard
      window.location.href = '/admin';
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            Ingresar a BabyClub Admin
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Email Input */}
            <Input
              {...register('email')}
              type="email"
              label="Correo Electrónico"
              placeholder="admin@babyclub.com"
              error={errors.email?.message}
              disabled={isLoading}
            />

            {/* Password Input */}
            <Input
              {...register('password')}
              type="password"
              label="Contraseña"
              placeholder="••••••"
              error={errors.password?.message}
              disabled={isLoading}
            />

            {/* Server Error */}
            {serverError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {serverError}
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              size="md"
              isLoading={isLoading}
              className="w-full"
            >
              {isLoading ? 'Ingresando...' : 'Ingresar'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * ============================================================================
 * EJEMPLO 2: Tabla de Eventos con Acciones
 * ============================================================================
 */

interface Event {
  id: string;
  name: string;
  date: string;
  status: 'draft' | 'published' | 'closed';
  tickets: number;
}

interface EventsTableProps {
  events: Event[];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

import { formatDate, Badge } from '@repo/ui';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@repo/ui';

export function EventsTable({ events, onEdit, onDelete }: EventsTableProps) {
  const getStatusBadge = (status: Event['status']) => {
    const variants: Record<Event['status'], React.ComponentProps<typeof Badge>['variant']> = {
      draft: 'secondary',
      published: 'success',
      closed: 'error',
    };

    const labels: Record<Event['status'], string> = {
      draft: 'Borrador',
      published: 'Publicado',
      closed: 'Cerrado',
    };

    return <Badge variant={variants[status]}>{labels[status]}</Badge>;
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Evento</TableHead>
          <TableHead>Fecha</TableHead>
          <TableHead>Tickets</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">Acciones</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {events.map((event) => (
          <TableRow key={event.id}>
            <TableCell className="font-medium">{event.name}</TableCell>
            <TableCell>{formatDate(event.date)}</TableCell>
            <TableCell>{event.tickets}</TableCell>
            <TableCell>{getStatusBadge(event.status)}</TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(event.id)}
              >
                Editar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => onDelete(event.id)}
              >
                Eliminar
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * ============================================================================
 * EJEMPLO 3: Modal/Dialog de Confirmación
 * ============================================================================
 */

interface ConfirmDialogProps {
  title: string;
  description: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
}

import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogContent,
  DialogFooter,
} from '@repo/ui';

export function ConfirmDialog({
  title,
  description,
  isOpen,
  onOpenChange,
  onConfirm,
}: ConfirmDialogProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <DialogContent>
        <p className="text-sm text-gray-600">{description}</p>
      </DialogContent>
      <DialogFooter>
        <Button
          variant="outline"
          onClick={() => onOpenChange(false)}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          variant="danger"
          onClick={handleConfirm}
          isLoading={isLoading}
        >
          Confirmar
        </Button>
      </DialogFooter>
    </Dialog>
  );
}

/**
 * ============================================================================
 * USO EN PÁGINA
 * ============================================================================
 */

'use client';

import { useState } from 'react';

export default function AdminEventsPage() {
  const [events, setEvents] = useState<Event[]>([
    {
      id: '1',
      name: 'Fiesta de Cumpleaños',
      date: '2026-02-14',
      status: 'published',
      tickets: 50,
    },
  ]);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    eventId: string | null;
  }>({ isOpen: false, eventId: null });

  const handleDelete = (id: string) => {
    setConfirmDialog({ isOpen: true, eventId: id });
  };

  const handleConfirmDelete = async () => {
    if (!confirmDialog.eventId) return;

    // API call para eliminar
    await fetch(`/api/events/${confirmDialog.eventId}`, {
      method: 'DELETE',
    });

    // Actualizar tabla
    setEvents(events.filter((e) => e.id !== confirmDialog.eventId));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Eventos</h1>
        <Button variant="primary">+ Nuevo Evento</Button>
      </div>

      <EventsTable
        events={events}
        onEdit={(id) => console.log('Edit:', id)}
        onDelete={handleDelete}
      />

      <ConfirmDialog
        title="Eliminar Evento"
        description="¿Estás seguro de que deseas eliminar este evento? Esta acción no se puede deshacer."
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) =>
          setConfirmDialog({ isOpen: open, eventId: null })
        }
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/**
 * ============================================================================
 * TIPS DE INTEGRACIÓN
 * ============================================================================
 * 
 * 1. IMPORTS
 *    - Siempre usa: import { Button, ... } from '@repo/ui'
 *    - Nunca uses: import Button from '@repo/ui' (no default exports)
 * 
 * 2. TIPOS
 *    - Importa tipos cuando sea necesario
 *    - Ejemplo: import type { ButtonProps } from '@repo/ui'
 * 
 * 3. VALIDACIÓN
 *    - Usa zod + react-hook-form para formularios
 *    - Usa error prop en Input para mostrar mensajes
 * 
 * 4. LOADING STATES
 *    - Siempre usa isLoading en Button durante async operations
 *    - Deshabilita inputs mientras isLoading = true
 * 
 * 5. ACCESIBILIDAD
 *    - Usa htmlFor en Label y vincula con id en Input
 *    - Usa role attributes donde sea necesario
 *    - Testea con screen reader (NVDA, JAWS, VoiceOver)
 * 
 * 6. RESPONSIVE
 *    - Usa Tailwind classes: sm:, md:, lg:, xl:
 *    - Testea en mobile, tablet, desktop
 * 
 * 7. TESTING
 *    - Usa @testing-library/react
 *    - Testea componentes, no implementación
 *    - Cubre casos de error y edge cases
 * 
 * 8. DOCUMENTACIÓN
 *    - Documenta props con JSDoc
 *    - Proporciona ejemplos en comentarios
 *    - Mantén README.md actualizado
 */
