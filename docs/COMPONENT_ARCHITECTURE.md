# Arquitectura de Componentes - Material Design + shadcn/ui

## 🎯 Objetivo

Proporcionar una librería centralizada de componentes profesionales con tema Material Design 3 que:
- ✅ Garantice consistencia visual en toda la plataforma
- ✅ Mejore mantenibilidad y reutilización
- ✅ Siga estándares de accesibilidad (WCAG 2.1 AA)
- ✅ Permita evolución sin afectar componentes existentes

## 📦 Arquitectura

```
apps/landing              apps/backoffice
    ↓                          ↓
├─ imports @repo/ui      ├─ imports @repo/ui
├─ tailwind.config.js    ├─ tailwind.config.js
└─ [components pages]    └─ [admin pages]
         ↓                      ↓
         └──────────────────────┘
                    ↓
         packages/ui/ (centralizado)
              ├─ src/
              │  ├─ components/
              │  │  ├─ button.tsx
              │  │  ├─ card.tsx
              │  │  ├─ input.tsx
              │  │  ├─ label.tsx
              │  │  ├─ badge.tsx
              │  │  ├─ select.tsx
              │  │  ├─ table.tsx
              │  │  └─ dialog.tsx
              │  ├─ theme.ts         (Material Design colors)
              │  ├─ utils.ts         (cn(), formatters, etc)
              │  └─ index.ts         (exports públicas)
              ├─ package.json        (deps: class-variance-authority, lucide-react)
              └─ README.md           (docs del componente)
```

## 🎨 Sistema de Diseño

### Paleta Material Design 3

| Rol | Color | Código |
|-----|-------|--------|
| Primary | Púrpura | #9c27b0 |
| Secondary | Azul Indigo | #7c4dff |
| Accent/Tertiary | Teal | #009688 |
| Success | Verde | #4caf50 |
| Warning | Naranja | #ff9800 |
| Error | Rojo | #f44336 |
| Info | Azul | #2196f3 |

### Espaciado (Scale 8px)
- `xs`: 4px
- `sm`: 8px
- `md`: 16px
- `lg`: 24px
- `xl`: 32px
- `2xl`: 48px

### Border Radius
- `sm`: 4px (subtle)
- `md`: 8px (standard)
- `lg`: 12px (prominent)
- `xl`: 16px (extra)
- `full`: 9999px (pills)

### Elevación (Material Shadows)
```
elevation1: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)
elevation2: 0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)
elevation3: 0 10px 20px rgba(0,0,0,0.19), 0 6px 6px rgba(0,0,0,0.23)
```

## 🔧 Stack Técnico

### Dependencias Clave
- **Radix UI:** Componentes accesibles sin estilos
- **class-variance-authority:** Manejo tipado de variantes
- **clsx + tailwind-merge:** Composición de clases segura
- **lucide-react:** Iconografía SVG
- **react-hook-form:** Gestión de formularios
- **zod:** Validación de esquemas

### Por Qué Esta Stack

| Librería | Razón |
|----------|-------|
| shadcn | Componentes copiados, no npm; control total |
| Radix UI | Accesibilidad WCAG 2.1 AA out-of-the-box |
| CVA | Variantes seguras y predecibles |
| Tailwind | Utilidades pequeñas, rápidas, responsive |

## 📋 Componentes Disponibles

### Button
```tsx
<Button variant="primary" size="md" isLoading={false}>
  Guardar
</Button>
```
**Variantes:** primary, secondary, accent, outline, ghost, danger, success
**Sizes:** sm, md, lg, icon
**Props:** disabled, isLoading, className, ...HTMLButtonAttributes

### Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descripción opcional</CardDescription>
  </CardHeader>
  <CardContent>Contenido</CardContent>
  <CardFooter>Pie de página</CardFooter>
</Card>
```

### Input
```tsx
<Input
  label="Email"
  type="email"
  placeholder="tu@email.com"
  error={errors.email?.message}
  disabled={false}
/>
```

### Label
```tsx
<Label htmlFor="field">Etiqueta</Label>
```

### Badge
```tsx
<Badge variant="success">Pagado</Badge>
```
**Variantes:** default, secondary, success, warning, error, info

### Select
```tsx
<Select
  label="Tipo"
  options={[
    { value: 'a', label: 'Opción A' },
    { value: 'b', label: 'Opción B', disabled: true },
  ]}
  placeholder="Selecciona..."
  error={errors.type?.message}
/>
```

### Table
```tsx
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Columna 1</TableHead>
      <TableHead>Columna 2</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Dato 1</TableCell>
      <TableCell>Dato 2</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Dialog
```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogHeader>
    <DialogTitle>Título</DialogTitle>
  </DialogHeader>
  <DialogContent>Contenido</DialogContent>
  <DialogFooter>
    <Button variant="outline" onClick={() => setIsOpen(false)}>
      Cancelar
    </Button>
    <Button variant="primary" onClick={handleConfirm}>
      Confirmar
    </Button>
  </DialogFooter>
</Dialog>
```

## 🛠️ Utilidades

### cn() - Composición segura de clases
```tsx
import { cn } from '@repo/ui';

const className = cn(
  'base',
  isActive && 'active',
  { 'error': hasError }
);
// Resultado: "base active" o "base error"
```

### Formatters
```tsx
import { formatCurrency, formatDate, formatTime } from '@repo/ui';

formatCurrency(100.50)      // S/ 100.50
formatDate(new Date())       // 8 de febrero de 2026
formatTime(new Date())       // 07:44
```

### debounce()
```tsx
const debouncedSearch = debounce((query: string) => {
  searchAPI(query);
}, 300);

<Input onChange={(e) => debouncedSearch(e.target.value)} />
```

## ✨ Buenas Prácticas

### 1. Accesibilidad Primero
```tsx
// ❌ Evitar
<input placeholder="Email" />

// ✅ Hacer
<Label htmlFor="email">Email</Label>
<Input id="email" type="email" placeholder="tu@email.com" />
```

### 2. Validación con react-hook-form + zod
```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email('Email inválido'),
});

const { register, formState: { errors } } = useForm({
  resolver: zodResolver(schema),
});

<Input {...register('email')} error={errors.email?.message} />
```

### 3. Estados de Carga
```tsx
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  try {
    await submitForm();
  } finally {
    setIsLoading(false);
  }
};

<Button isLoading={isLoading}>Guardar</Button>
```

### 4. Composición por Responsabilidad
```tsx
// ❌ Evitar: componentes monolíticos
export function UserCard() {
  return (
    <div className="p-6 bg-white rounded-lg border shadow">
      <h2 className="text-lg font-semibold">Nombre</h2>
      <p className="text-sm text-gray-600">Email</p>
    </div>
  );
}

// ✅ Hacer: usando componentes reutilizables
export function UserCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nombre</CardTitle>
        <CardDescription>Email</CardDescription>
      </CardHeader>
    </Card>
  );
}
```

### 5. Type Safety
```tsx
// Siempre exporta tipos
export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary';
  size?: 'sm' | 'md' | 'lg';
};

// Úsalos en tu código
const MyButton: React.FC<ButtonProps> = ({ variant, ...props }) => {
  return <Button variant={variant} {...props} />;
};
```

## 🚀 Migración Paso a Paso

### Fase 1: Setup (✅ COMPLETADO)
- [x] Crear estructura packages/ui
- [x] Implementar componentes base
- [x] Actualizar dependencias
- [x] Documentación

### Fase 2: Landing
**Duración estimada:** 1-2 horas
- [ ] Reemplazar Button en pages
- [ ] Reemplazar Card en registro
- [ ] Reemplazar Input en formularios
- [ ] Testing visual

### Fase 3: Backoffice
**Duración estimada:** 4-6 horas
- [ ] Migrar layout principal
- [ ] Migrar todas las tablas admin
- [ ] Migrar formularios
- [ ] Migrar modales/diálogos
- [ ] Testing funcional completo

### Fase 4: Refinement (2-3 horas)
- [ ] Ajustes visuales finales
- [ ] Testing de accesibilidad
- [ ] Performance audit
- [ ] Documentación final

## 📚 Referencias

- [Material Design 3 Spec](https://m3.material.io/)
- [Radix UI Docs](https://www.radix-ui.com/docs/primitives)
- [CVA Docs](https://cva.style/docs)
- [Tailwind CSS](https://tailwindcss.com/)
- [React Hook Form](https://react-hook-form.com/)
- [Zod](https://zod.dev/)

## 🔍 Testing

Cada componente debe probarse:

```tsx
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' }))
      .toBeInTheDocument();
  });

  it('calls onClick handler', async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalled();
  });

  it('shows loading state', () => {
    render(<Button isLoading>Click</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
```

## 🐛 Troubleshooting

**P: Estilos Tailwind no funcionan**
A: Verifica `tailwind.config.js` incluya path a `packages/ui`

**P: Module not found '@repo/ui'**
A: Ejecuta `pnpm install` en la app

**P: Props desconocidas en componentes**
A: Revisa tipos en archivo .tsx del componente

**P: Diferencias visuales entre apps**
A: Asegúrate que ambas usen mismo config tailwind

## 📦 Próximas Adiciones

- [ ] Alert/Toast (notificaciones)
- [ ] Tooltip avanzado
- [ ] Dropdown menu mejorado
- [ ] Tabs
- [ ] Accordion
- [ ] Checkbox
- [ ] Radio
- [ ] Textarea
- [ ] DatePicker profesional
- [ ] Pagination
- [ ] Skeleton loaders
- [ ] Modal dialog avanzado
- [ ] Popover
- [ ] Search/Command palette

## 💡 Decisiones de Arquitectura (ADRs)

Ver `/docs/adr/` para decisiones técnicas relacionadas.

## ✅ Checklist para nuevos componentes

- [ ] Cumple especificación Material Design
- [ ] Implementado con Radix UI primitives
- [ ] Tipos TypeScript completos
- [ ] Accesibilidad (WCAG 2.1 AA)
- [ ] Responsive design
- [ ] Tests unitarios
- [ ] Documentado con ejemplos
- [ ] Exportado en index.ts

---

**Versión:** 1.0.0
**Última actualización:** 2026-02-08
**Mantenedor:** Frontend Team
