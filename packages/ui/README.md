# UI Component Library - shadcn/ui + Material Design

## Visión General

Librería de componentes React profesional basada en **shadcn/ui** con tema **Material Design 3** (MATE). Diseñada para consistencia visual, accesibilidad y reutilización en toda la plataforma BabyClub.

## Estructura

```
packages/ui/
├── src/
│   ├── components/        # Componentes reutilizables
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── label.tsx
│   │   ├── badge.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   └── dialog.tsx
│   ├── hooks/             # Custom hooks (próximos)
│   ├── theme.ts           # Configuración Material Design
│   ├── utils.ts           # Utilidades compartidas
│   └── index.ts           # Exportaciones públicas
└── package.json
```

## Componentes Disponibles

### Button
```tsx
import { Button } from '@repo/ui';

<Button variant="primary" size="md">
  Guardar
</Button>

<Button variant="outline" isLoading>
  Enviando...
</Button>
```

**Variantes:** `primary`, `secondary`, `accent`, `outline`, `ghost`, `danger`, `success`
**Sizes:** `sm`, `md`, `lg`, `icon`

### Card
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@repo/ui';

<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>Contenido</CardContent>
</Card>
```

### Input
```tsx
import { Input } from '@repo/ui';

<Input
  type="text"
  label="Email"
  placeholder="tu@email.com"
  error={errors.email?.message}
/>
```

### Label
```tsx
import { Label } from '@repo/ui';

<Label htmlFor="email">Correo electrónico</Label>
```

### Badge
```tsx
import { Badge } from '@repo/ui';

<Badge variant="success">Pagado</Badge>
```

**Variantes:** `default`, `secondary`, `success`, `warning`, `error`, `info`

### Select
```tsx
import { Select } from '@repo/ui';

<Select
  label="Tipo"
  options={[
    { value: 'adult', label: 'Adulto' },
    { value: 'child', label: 'Niño' },
  ]}
  error={errors.type?.message}
/>
```

### Table
```tsx
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@repo/ui';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Nombre</TableHead>
      <TableHead>Estado</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Juan</TableCell>
      <TableCell>Activo</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Dialog
```tsx
import { Dialog, DialogHeader, DialogTitle, DialogContent } from '@repo/ui';

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogHeader>
    <DialogTitle>Confirmar</DialogTitle>
  </DialogHeader>
  <DialogContent>¿Deseas continuar?</DialogContent>
</Dialog>
```

## Utilidades

### Formateo
```tsx
import { formatCurrency, formatDate, formatTime } from '@repo/ui';

formatCurrency(100.50)    // S/ 100.50
formatDate(new Date())     // 8 de febrero de 2026
formatTime(new Date())     // 07:44
```

### Utilidad cn()
```tsx
import { cn } from '@repo/ui';

const className = cn(
  'base-class',
  condition && 'conditional-class',
  variableClass
);
```

### Debounce
```tsx
import { debounce } from '@repo/ui';

const debouncedSearch = debounce((query) => {
  // Búsqueda
}, 300);
```

## Tema Material Design

### Colores
- **Primary:** Púrpura (#9c27b0)
- **Secondary:** Azul (#7c4dff)
- **Accent:** Teal (#009688)
- **Status:** Verde (éxito), Naranja (aviso), Rojo (error), Azul (info)
- **Neutral:** Escala de grises

### Espaciado
- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `2xl`: 48px

### Border Radius
- `sm`: 4px
- `md`: 8px
- `lg`: 12px
- `xl`: 16px
- `full`: 9999px

### Sombras (Material Elevation)
- `elevation1`: Sutil
- `elevation2`: Moderado
- `elevation3`: Prominente

## Buenas Prácticas

### 1. Composición
Siempre usa componentes como bloques de construcción:

```tsx
// ❌ Evitar: componentes monolíticos
<div className="p-6 bg-white rounded-lg border">
  <h2>Título</h2>
  <p>Contenido</p>
</div>

// ✅ Preferir: componentes reutilizables
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
  </CardHeader>
  <CardContent>Contenido</CardContent>
</Card>
```

### 2. Accesibilidad
- Todos los inputs deben tener labels asociadas
- Use `error` prop para mostrar errores de validación
- Mantén orden de tabulación lógico
- Usa `disabled` para estados inactivos

```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" error={error} />
```

### 3. Responsive Design
- Usa Tailwind classes para responsive
- Prioriza mobile-first
- Testea en múltiples dispositivos

```tsx
<Button className="w-full sm:w-auto">
  Enviar
</Button>
```

### 4. Estado de Carga
- Siempre usa `isLoading` en botones con acciones async

```tsx
<Button isLoading={isLoading}>
  {isLoading ? 'Cargando...' : 'Enviar'}
</Button>
```

### 5. Variantes y Semántica
- `primary`: Acciones principales
- `secondary`: Acciones secundarias
- `danger`: Acciones destructivas
- `success`: Confirmaciones
- `outline`: Acciones reversibles
- `ghost`: Acciones terciarias

### 6. Form Integration
Integración con `react-hook-form`:

```tsx
import { useForm } from 'react-hook-form';
import { Input, Button } from '@repo/ui';

const { register, formState: { errors } } = useForm();

<form>
  <Input
    {...register('email', { required: 'Requerido' })}
    error={errors.email?.message}
  />
  <Button type="submit">Enviar</Button>
</form>
```

## Próximas Adiciones

- [ ] Alert / Toast
- [ ] Tooltip (Radix UI integración)
- [ ] Dropdown Menu
- [ ] Tabs
- [ ] Accordion
- [ ] Checkbox
- [ ] Radio
- [ ] Textarea
- [ ] DatePicker
- [ ] Pagination
- [ ] Loading Skeleton
- [ ] Modal (Dialog mejorado)
- [ ] Popover
- [ ] Command/SearchBox

## Performance

- Componentes son memoized cuando necesario
- Lazy loading en componentes complejos
- Code splitting automático vía Next.js
- Tree-shaking de utilidades no usadas

## Testing

Cada componente debe tener:
- Tests unitarios de renderizado
- Tests de accesibilidad
- Tests de interacción

```tsx
// components/button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

## Migración desde V1

Para migrar componentes existentes:

1. **Identifica** componentes obsoletos
2. **Mapea** a equivalentes en @repo/ui
3. **Reemplaza** imports
4. **Testea** regresión visual
5. **Documenta** cambios en CHANGELOG

Ejemplo:
```tsx
// V1 (obsoleto)
import { OldButton } from './custom-button';

// V2 (nuevo)
import { Button } from '@repo/ui';
```

## Recursos

- [Material Design 3](https://m3.material.io/)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Radix UI](https://www.radix-ui.com/)

## Preguntas o Sugerencias?

Abre un issue en el repo o contacta al equipo de frontend.
