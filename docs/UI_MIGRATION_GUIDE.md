# Guía de Migración: shadcn/ui + Material Design

## Resumen Ejecutivo

Se ha implementado una librería de componentes profesional basada en **shadcn/ui** con tema **Material Design 3** en `packages/ui`. Esta guía facilita la migración en ambas apps.

**Beneficios:**
- ✅ Componentes consistentes en toda la plataforma
- ✅ Mejor accesibilidad (Radix UI + ARIA)
- ✅ Tema Material Design profesional
- ✅ Reutilización de código
- ✅ Mantenimiento centralizado
- ✅ Type-safe con TypeScript

## Impacto por App

### Landing (`apps/landing`)
- Migración pequeña (solo 3 básicos)
- Afecta: homepage, página de compra, registro
- Riesgo: Bajo
- Tiempo: 1-2 horas

### Backoffice (`apps/backoffice`)
- Migración media (componentes administrativos)
- Afecta: todas las páginas admin
- Riesgo: Medio (múltiples vistas)
- Tiempo: 4-6 horas

## Paso 1: Actualizar Imports

### De:
```tsx
// Componentes custom o sin librería
import { OldButton } from './custom-button';
import Button from '@/components/ui/button';
```

### A:
```tsx
// Nueva librería centralizada
import { Button, Card, Input, Badge } from '@repo/ui';
```

## Paso 2: Reemplazar Componentes

### Button
**Antes:**
```tsx
<button className="px-4 py-2 bg-blue-600 text-white rounded">
  Click
</button>
```

**Después:**
```tsx
import { Button } from '@repo/ui';

<Button variant="primary">
  Click
</Button>
```

### Card
**Antes:**
```tsx
<div className="bg-white rounded-lg shadow p-6 border">
  <h2>Título</h2>
  <p>Contenido</p>
</div>
```

**Después:**
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
**Antes:**
```tsx
<input
  type="text"
  className="border px-3 py-2 rounded"
  placeholder="Email"
/>
```

**Después:**
```tsx
import { Input } from '@repo/ui';

<Input
  type="email"
  label="Email"
  placeholder="tu@email.com"
  error={errors?.email?.message}
/>
```

### Table
**Antes:**
```tsx
<table className="w-full">
  <thead><tr><th>Name</th></tr></thead>
  <tbody><tr><td>John</td></tr></tbody>
</table>
```

**Después:**
```tsx
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@repo/ui';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

## Paso 3: Utilidades

### Formateo
```tsx
import { formatCurrency, formatDate, formatTime } from '@repo/ui';

// Antes
const formatted = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
}).format(100.50);

// Después
const formatted = formatCurrency(100.50); // S/ 100.50
```

### Clases Condicionales
```tsx
import { cn } from '@repo/ui';

// Combina clases Tailwind de forma segura
const className = cn(
  'base-classes',
  isActive && 'active-class',
  variant === 'primary' && 'primary-class'
);
```

## Paso 4: Form Validation

**Recomendado:** Usa `react-hook-form` + `zod`

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input, Button } from '@repo/ui';

const schema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6),
});

export default function LoginForm() {
  const { register, formState: { errors }, handleSubmit } = useForm({
    resolver: zodResolver(schema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register('email')}
        label="Email"
        error={errors.email?.message}
      />
      <Input
        {...register('password')}
        type="password"
        label="Contraseña"
        error={errors.password?.message}
      />
      <Button type="submit">Ingresar</Button>
    </form>
  );
}
```

## Paso 5: Temas y Personalizaciones

El tema está centralizado en `packages/ui/src/theme.ts`:

```typescript
export const materialDesignTheme = {
  primary: { 500: '#9c27b0', ... },
  secondary: { 500: '#7c4dff', ... },
  accent: { 500: '#009688', ... },
  // ... más colores
};
```

Para **personalizar colores por cliente/evento**, extiende Tailwind:

```js
// apps/backoffice/tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#9c27b0',
        secondary: '#7c4dff',
      },
    },
  },
};
```

## Paso 6: Estados y Loading

Todos los botones soportan `isLoading`:

```tsx
const [isLoading, setIsLoading] = useState(false);

const handleSubmit = async () => {
  setIsLoading(true);
  await saveData();
  setIsLoading(false);
};

<Button isLoading={isLoading}>
  {isLoading ? 'Guardando...' : 'Guardar'}
</Button>
```

## Paso 7: Accesibilidad

**Siempre** asocia labels a inputs:

```tsx
// ❌ Evitar
<input placeholder="Email" />

// ✅ Hacer
<Input label="Email" placeholder="tu@email.com" />
```

**Use labels explícitos con aria:**

```tsx
import { Label } from '@repo/ui';

<Label htmlFor="email">Email</Label>
<Input id="email" />
```

## Checklist de Migración

### Landing (`apps/landing`)
- [ ] Actualizar `package.json` ✅
- [ ] Actualizar `tailwind.config.js` ✅
- [ ] Migrar Button en homepage
- [ ] Migrar Card en página de registro
- [ ] Migrar Input en formularios
- [ ] Testear responsive en mobile
- [ ] Validar visual vs. wireframes

### Backoffice (`apps/backoffice`)
- [ ] Actualizar `package.json` ✅
- [ ] Actualizar `tailwind.config.js` ✅
- [ ] Migrar layout principal (nav, sidebar)
- [ ] Migrar todas las tablas
- [ ] Migrar formularios (events, tables, etc.)
- [ ] Migrar modales y diálogos
- [ ] Migrar badges y status indicators
- [ ] Validar dark mode (si aplica)
- [ ] Testing QA completo

## Problemas Comunes

### 1. Imports circulares
**Síntoma:** `Module not found` o `Cannot find module`
**Solución:** Asegúrate que `@repo/ui` está en `package.json`

```bash
# En el directorio de la app
pnpm install
```

### 2. Clases Tailwind no se aplican
**Síntoma:** Estilos no aparecen
**Solución:** Verifica `tailwind.config.js` incluye el path a `packages/ui`:

```js
content: [
  "./app/**/*.{js,ts,jsx,tsx,mdx}",
  "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}", // ← Esto
],
```

### 3. TypeScript errors
**Síntoma:** Type errors en componentes
**Solución:** Ejecuta `pnpm check-types` en la app

```bash
cd apps/backoffice && pnpm check-types
```

### 4. Props desconocidas en componentes
**Síntoma:** Props como `variant` no existen
**Solución:** Revisa documentación en `packages/ui/README.md`

## Próximos Pasos

1. **Fase actual:** Setup y documentación ✅
2. **Fase próxima:** Migración landing (1-2h)
3. **Fase final:** Migración backoffice (4-6h)
4. **Refinement:** Testing y ajustes finales (2-3h)

## Soporte

- 📖 Docs: `/packages/ui/README.md`
- 🎨 Tema: `/packages/ui/src/theme.ts`
- 💬 Preguntas: Contacta al equipo frontend

---

**Versión:** 1.0.0
**Fecha:** 2026-02-08
**Autor:** Frontend Team
