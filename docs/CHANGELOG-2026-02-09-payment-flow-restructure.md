# Reestructuración del Flujo de Compra - BabyClub Landing

## Fecha: 2026-02-09

## Problema Identificado

1. **Mesas mezcladas entre organizadores**: Se mostraban mesas de Colorimetría cuando debería verse solo BABY
2. **Croquis/layout incorrecto**: No se cargaba el plano específico del evento/organizador
3. **Flujo no preparado para Izipay**: Necesita estructura para migrar de reserva manual a pasarela

## Solución Implementada

### 1. Multi-Organizador con Aislamiento Completo

#### API `/api/tables`
- **Antes**: Devolvía todas las mesas sin filtro
- **Ahora**: 
  - Filtra por `organizer_id` (desde `NEXT_PUBLIC_ORGANIZER_ID`)
  - Filtra por `event_id` (si se especifica)
  - Incluye información del evento en la respuesta

```typescript
// Ejemplo de uso
GET /api/tables?organizer_id=xxx&event_id=yyy
```

#### API `/api/layout`
- **Antes**: Devolvía un layout global desde `id=1`
- **Ahora**: 
  - Busca en `layout_settings` por `organizer_id` + `event_id`
  - Fallback a layout del organizador (último creado)
  - Fallback final a layout legacy (id=1)

```typescript
// Ejemplo de uso
GET /api/layout?organizer_id=xxx&event_id=yyy
```

### 2. Variables de Entorno Nuevas

Agregadas a `.env.example`:

```bash
# Multi-organizador
NEXT_PUBLIC_ORGANIZER_ID=<uuid-del-organizador-baby>
NEXT_PUBLIC_ORGANIZER_NAME=BABY

# Payment Methods
ENABLE_ONLINE_PAYMENTS=false
PAYMENT_METHOD=reservation # options: reservation, izipay, culqi

# Izipay (preparado para futura integración)
IZIPAY_MERCHANT_ID=
IZIPAY_ACCESS_KEY=
IZIPAY_SECRET_KEY=
IZIPAY_API_BASE_URL=https://apisandbox.vnforappstest.com
```

### 3. Estructura de Payment Methods

Creado archivo `lib/payment-config.ts` con:

- **Configuración centralizada** de métodos de pago
- **3 modos soportados**:
  - `reservation`: Yape/Plin con upload de voucher (ACTUAL)
  - `izipay`: Niubiz payment gateway (PREPARADO)
  - `culqi`: Legacy fallback (PREPARADO)

- **Helpers**:
  - `getPaymentConfig()`: Configuración activa
  - `shouldShowOnlinePayment()`: Si mostrar pasarela
  - `requiresVoucherUpload()`: Si requiere comprobante
  - `getPaymentInstructions()`: Texto dinámico según método
  - `getPaymentButtonText()`: CTA dinámico del botón

### 4. Página de Compra Actualizada

**Cambios en `apps/landing/app/compra/page.tsx`**:

```typescript
// Carga mesas filtradas por organizador y evento
const organizerId = process.env.NEXT_PUBLIC_ORGANIZER_ID;

useEffect(() => {
  const params = new URLSearchParams();
  if (organizerId) params.append('organizer_id', organizerId);
  if (selectedEventId) params.append('event_id', selectedEventId);
  
  fetch(`/api/tables?${params}`)...
}, [selectedEventId, organizerId]);

// Carga layout específico del organizador+evento
useEffect(() => {
  const params = new URLSearchParams();
  if (organizerId) params.append('organizer_id', organizerId);
  if (selectedEventId) params.append('event_id', selectedEventId);
  
  fetch(`/api/layout?${params}`)...
}, [selectedEventId, organizerId]);
```

## Cómo Configurar

### Para BABY (producción)

1. **Obtener el `organizer_id` de BABY**:
```sql
SELECT id, name FROM public.organizers WHERE name ILIKE '%baby%';
```

2. **Configurar en `.env.local`**:
```bash
NEXT_PUBLIC_ORGANIZER_ID=<uuid-de-baby>
NEXT_PUBLIC_ORGANIZER_NAME=BABY
```

3. **Subir croquis específico de BABY**:
```sql
-- Insertar layout para BABY en evento específico
INSERT INTO public.layout_settings (organizer_id, event_id, layout_url)
VALUES (
  '<uuid-de-baby>',
  '<uuid-del-evento>',
  'https://tu-cdn/baby-layout.png'
);
```

### Para Colorimetría (u otro organizador)

1. Obtener su `organizer_id` de la BD
2. Crear nuevo deployment con su propio `NEXT_PUBLIC_ORGANIZER_ID`
3. Subir su layout específico a `layout_settings`

## Migración a Izipay (Futuro)

Cuando esté listo para integrar Izipay:

### 1. Configurar credenciales
```bash
ENABLE_ONLINE_PAYMENTS=true
PAYMENT_METHOD=izipay
IZIPAY_MERCHANT_ID=tu_merchant_id
IZIPAY_ACCESS_KEY=tu_access_key
IZIPAY_SECRET_KEY=tu_secret_key
```

### 2. El código ya está preparado

El archivo `payment-config.ts` ya detectará automáticamente el cambio y:
- Ocultará upload de voucher
- Mostrará botón "Pagar ahora"
- Cambiará instrucciones de pago

### 3. Implementar API de Izipay

Crear endpoints:
- `POST /api/izipay/create-token` - Generar token de pago
- `POST /api/izipay/confirm` - Confirmar transacción
- `POST /api/izipay/webhook` - Recibir notificaciones

## Testing

### Verificar aislamiento de organizador

```bash
# Solo mesas de BABY
curl "http://localhost:3001/api/tables?organizer_id=<baby-id>"

# Solo layout de BABY para evento X
curl "http://localhost:3001/api/layout?organizer_id=<baby-id>&event_id=<event-id>"
```

### Verificar payment config

```typescript
import { getPaymentConfig } from '@/lib/payment-config';

console.log(getPaymentConfig());
// Expected: { method: 'reservation', enabled: true, requiresVoucher: true, ... }
```

## Arquitectura de Datos

### Tabla `layout_settings`

```sql
CREATE TABLE public.layout_settings (
  id uuid PRIMARY KEY,
  organizer_id uuid NOT NULL REFERENCES organizers(id),
  event_id uuid NOT NULL REFERENCES events(id),
  layout_url text,
  canvas_width integer DEFAULT 800,
  canvas_height integer DEFAULT 600,
  scale numeric DEFAULT 1.0,
  UNIQUE(organizer_id, event_id)
);
```

### Tabla `tables`

```sql
ALTER TABLE public.tables
ADD COLUMN organizer_id uuid REFERENCES organizers(id);

CREATE INDEX idx_tables_organizer_event 
ON public.tables(organizer_id, event_id);
```

## Ventajas de esta Arquitectura

1. **Aislamiento total**: Cada organizador ve solo sus mesas y layout
2. **Escalable**: Agregar nuevos organizadores es solo config
3. **Preparado para Izipay**: Switch con solo cambiar env vars
4. **Backwards compatible**: Mantiene flujo actual de reserva
5. **Zero downtime**: Migración gradual posible

## Próximos Pasos

1. ✅ Configurar `NEXT_PUBLIC_ORGANIZER_ID` en producción
2. ✅ Subir layout de BABY a `layout_settings`
3. ⏳ Verificar que solo aparecen mesas de BABY
4. ⏳ Testing end-to-end del flujo de reserva
5. ⏳ Cuando Izipay esté listo: cambiar env vars y activar

---

**Estado**: ✅ Completado y listo para configuración  
**Breaking Changes**: Ninguno (backwards compatible)  
**Requiere Migración BD**: No (ya existe desde 2026-02-08)
