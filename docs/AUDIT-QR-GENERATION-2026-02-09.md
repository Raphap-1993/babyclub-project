# Auditoría Completa: Generación de QR Gratuito
**Fecha**: 2026-02-09  
**Motivo**: Usuario reporta que sigue apareciendo QR de evento antiguo

## 1. Flujo End-to-End

### 1.1 Frontend: apps/landing/app/registro/page.tsx

#### Función `createTicketAndRedirect` (líneas 1194-1250)

**Estado Actual**:
```typescript
async function createTicketAndRedirect(extraCodes?: string[]) {
  setError(null);
  if (extraCodes?.length) setReservationError(null);
  
  // ⚠️ PROBLEMA #1: Si hay ticketId existente, redirige sin validar evento
  if (ticketId) {
    router.push(`/ticket/${ticketId}`);
    return;
  }
  
  // Validaciones de formulario...
  
  // POST a /api/tickets
  const res = await fetch("/api/tickets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,  // ⚠️ PROBLEMA #2: No envía codeEventId para validar
      doc_type: form.doc_type,
      document: form.document,
      // ... resto de campos
    }),
  });
  
  // Procesa respuesta y redirige
  setTicketId(data.ticketId);
  setExistingTicketId(data.ticketId);
  router.push(`/ticket/${data.ticketId}`);
}
```

**Problemas Identificados**:

1. **ticketId existente redirige sin validación**: 
   - Si `ticketId` está seteado (de búsqueda anterior o evento pasado)
   - Redirige directo a `/ticket/${ticketId}` sin verificar si pertenece al evento actual
   - **Síntoma**: Usuario con QR de evento anterior accede a nuevo evento y ve su QR viejo

2. **No envía event_id al endpoint**: 
   - Solo envía `code` pero no `codeEventId`
   - El endpoint debe resolver el `event_id` desde el código
   - No hay validación explícita frontend de que el ticket sea del evento correcto

#### Función `lookupDocument` (líneas 1100-1189)

**Estado Actual**:
```typescript
async function lookupDocument(dni: string) {
  // ... validaciones ...
  
  const res = await fetch(`/api/persons?${params.toString()}`);
  const data = await res.json();
  
  // Extrae ticket_event_id del resultado
  const ticketEventIdFromPerson = (p as any)?.ticket_event_id || null;
  
  // ✅ CORRECTO: Valida que el ticket sea del mismo evento
  const isTicketFromCurrentEvent = !codeEventId || ticketEventIdFromPerson === codeEventId;
  
  if (ticketFromPerson && isTicketFromCurrentEvent) {
    setExistingTicketId(ticketFromPerson);
    setTicketId(ticketFromPerson);
  } else if (ticketFromPerson && !isTicketFromCurrentEvent) {
    // ✅ CORRECTO: Limpia ticket antiguo si es de otro evento
    setExistingTicketId(null);
    setTicketId(null);
  }
}
```

**Estado**: ✅ Funciona correctamente cuando se usa búsqueda manual

### 1.2 Backend: apps/landing/app/api/tickets/route.ts

**Estado Actual** (líneas 141-161):
```typescript
// ✅ CORRECTO: Valida si ya existe ticket para este evento
const { data: existingTicket, error: existingError } = await supabase
  .from("tickets")
  .select("id,qr_token")
  .eq("event_id", eventId)  // ✅ Filtra por event_id del código
  .eq("person_id", person_id)
  .limit(1)
  .maybeSingle();

if (existingTicket?.id && existingTicket.qr_token) {
  return NextResponse.json({
    success: true,
    existing: true,
    ticketId: existingTicket.id,
    qr: existingTicket.qr_token,
  });
}
```

**Estado**: ✅ El endpoint ya valida correctamente

### 1.3 API de Consulta: apps/landing/app/api/persons/route.ts

**Estado Actual** (líneas 130, 152):
```typescript
// ✅ CORRECTO: Filtra tickets por evento y excluye cancelados
.eq("tickets.event_id", codeEventId)
.neq("tickets.status", "cancelled")
```

**Estado**: ✅ Funciona correctamente

## 2. Análisis del Problema Reportado

### Escenario: "Me volvió a salir un QR de un evento pasado"

#### Caso A: Usuario tiene QR antiguo en sessionStorage
1. Usuario visitó evento anterior
2. Frontend guardó `ticketId` en estado local/sessionStorage
3. Usuario accede a nuevo evento
4. `createTicketAndRedirect()` detecta `ticketId` existente
5. ❌ Redirige a `/ticket/{ticketId-antiguo}` sin validar evento

**Línea problemática**: [registro/page.tsx](apps/landing/app/registro/page.tsx#L1196-L1199)
```typescript
if (ticketId) {
  router.push(`/ticket/${ticketId}`);
  return;
}
```

#### Caso B: Usuario usa búsqueda manual correctamente
1. Usuario ingresa DNI y presiona lupa
2. `lookupDocument()` ejecuta
3. ✅ Valida `isTicketFromCurrentEvent`
4. ✅ Limpia ticket antiguo si no coincide evento
5. ✅ Funciona correctamente

#### Caso C: Usuario hace click directo en "Generar QR"
1. Usuario no usa búsqueda manual
2. `ticketId` está vacío
3. POST a `/api/tickets` con code + datos
4. ✅ Endpoint valida evento y devuelve ticket existente o crea nuevo
5. ✅ Funciona correctamente

## 3. Root Cause Confirmado

**Problema Principal**: 
La función `createTicketAndRedirect()` tiene un **early return** que redirige a cualquier `ticketId` existente sin validar que pertenezca al evento actual del código ingresado.

**Código Problemático**: [registro/page.tsx](apps/landing/app/registro/page.tsx#L1196-L1199)

## 4. Solución Propuesta

### Opción A: Validar ticketId antes de redirigir (RECOMENDADA)

```typescript
async function createTicketAndRedirect(extraCodes?: string[]) {
  setError(null);
  if (extraCodes?.length) setReservationError(null);
  
  // ✅ NUEVO: Validar que el ticket existente sea del evento actual
  if (ticketId) {
    // Si tenemos codeEventId, validar que el ticket pertenezca a este evento
    if (codeEventId && existingTicketEventId && existingTicketEventId !== codeEventId) {
      // Ticket es de otro evento, limpiar y continuar con creación
      setTicketId(null);
      setExistingTicketId(null);
      // Continuar con el flujo normal de creación
    } else {
      // Ticket válido, redirigir
      router.push(`/ticket/${ticketId}`);
      return;
    }
  }
  
  // ... resto del flujo
}
```

**Cambios necesarios**:
1. Agregar estado `existingTicketEventId` cuando se setea `ticketId`
2. Validar en el early return que `existingTicketEventId === codeEventId`
3. Limpiar `ticketId` si no coincide evento

### Opción B: Eliminar early return y siempre validar con backend

```typescript
async function createTicketAndRedirect(extraCodes?: string[]) {
  // Eliminar el early return
  // Siempre hacer POST a /api/tickets
  // El endpoint ya valida y devuelve ticket existente si aplica
  
  const res = await fetch("/api/tickets", {
    method: "POST",
    // ...
  });
  
  const data = await res.json();
  
  // Backend ya validó y devolvió ticket correcto (existente o nuevo)
  setTicketId(data.ticketId);
  router.push(`/ticket/${data.ticketId}`);
}
```

**Ventajas**:
- Más simple
- Backend es source of truth
- No duplica lógica de validación

**Desventajas**:
- Llamada HTTP innecesaria si ticket es válido

### Opción C: Trackear eventId del ticket en estado

```typescript
// En lookupDocument cuando se setea ticket:
if (ticketFromPerson && isTicketFromCurrentEvent) {
  setExistingTicketId(ticketFromPerson);
  setTicketId(ticketFromPerson);
  setExistingTicketEventId(ticketEventIdFromPerson); // ✅ NUEVO
}

// En createTicketAndRedirect:
if (ticketId && existingTicketEventId === codeEventId) {
  router.push(`/ticket/${ticketId}`);
  return;
}
```

## 5. Verificación de Otros Flujos

### ✅ Flujo de Reserva de Mesa
- **Archivo**: [apps/landing/app/registro/page.tsx](apps/landing/app/registro/page.tsx#L760-L920)
- **Estado**: No aplica este problema (no usa ticketId existente)

### ✅ Flujo de Escaneo QR
- **Archivo**: apps/backoffice (scanner)
- **Estado**: Valida por qr_token, no afectado

### ✅ Flujo de Aprobación de Reservas
- **Archivo**: [apps/backoffice/app/api/reservations/update/route.ts](apps/backoffice/app/api/reservations/update/route.ts)
- **Estado**: Crea tickets nuevos con event_id correcto

## 6. Testing Requerido

### Escenario 1: Usuario con ticket antiguo
1. Usuario tiene QR del evento "Love is in the Air" (ID: xxx)
2. Accede a landing con código del evento "Carnaval 2026" (ID: yyy)
3. Ingresa DNI y presiona "Generar QR"
4. **Esperado**: ❌ Redirige a ticket antiguo
5. **Deseado**: ✅ Crea o muestra ticket del evento actual

### Escenario 2: Usuario con ticket antiguo usa búsqueda
1. Usuario tiene QR antiguo
2. Ingresa DNI y presiona lupa
3. **Actual**: ✅ Limpia ticket antiguo, permite crear nuevo

### Escenario 3: Usuario sin ticket previo
1. Usuario nuevo
2. Completa form y presiona "Generar QR"
3. **Actual**: ✅ Crea ticket correctamente

### Escenario 4: Usuario con ticket del mismo evento
1. Usuario ya tiene QR del evento actual
2. Vuelve a intentar generar QR
3. **Actual**: 
   - Con búsqueda: ✅ Muestra "Ver mi QR"
   - Sin búsqueda: ✅ Backend devuelve ticket existente

## 7. Recomendación Final

**Implementar Opción C**: Trackear `existingTicketEventId` en estado

**Razones**:
1. Mantiene la optimización del early return (evita llamada HTTP)
2. Valida consistentemente en frontend (igual que `lookupDocument`)
3. Cambio mínimo, bajo riesgo
4. Alinea ambos flujos (búsqueda manual y generar directo)

**Cambios específicos**:
1. Agregar estado: `const [existingTicketEventId, setExistingTicketEventId] = useState<string | null>(null);`
2. Setear en `lookupDocument` (línea ~1178)
3. Validar en `createTicketAndRedirect` (línea ~1197)
4. Limpiar en `handleCodeChange` junto con `ticketId`

## 8. Checklist Post-Fix

- [ ] Agregar estado `existingTicketEventId`
- [ ] Actualizar `lookupDocument` para trackear event_id
- [ ] Actualizar `createTicketAndRedirect` con validación
- [ ] Limpiar en `handleCodeChange`
- [ ] Test: Usuario con QR antiguo → código nuevo → "Generar QR"
- [ ] Test: Usuario con QR antiguo → búsqueda manual
- [ ] Test: Usuario sin QR → código → "Generar QR"
- [ ] Test: Usuario con QR actual → búsqueda
- [ ] Verificar sessionStorage/localStorage no persiste entre eventos

## 9. Observaciones Adicionales

### Estado de otros componentes:

✅ **Backend validations**: Todos correctos
- `/api/tickets` valida evento correctamente
- `/api/persons` filtra por evento
- Reservations crea con event_id correcto

✅ **Arquitectura V2**: 
- Strangler pattern aplicándose correctamente
- Domain boundaries respetados

⚠️ **Pendiente**:
- Migración `promoter_id` en `table_reservations` (SQL creado, no aplicado)
- Documentar este fix en `CHANGELOG-2026-02-09-ticket-validation-fix.md`

---

**Próximos pasos**:
1. Implementar fix de validación de `ticketId`
2. Testing exhaustivo de todos los escenarios
3. Deploy y verificación en producción
4. Monitorear logs de tickets duplicados
