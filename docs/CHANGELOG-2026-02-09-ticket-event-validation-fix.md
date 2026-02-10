# CHANGELOG: Fix Validación de Tickets por Evento
**Fecha**: 2026-02-09  
**Tipo**: Bug Fix  
**Severidad**: Alta  
**Autor**: Sistema

## Problema Reportado

Usuario reportó que sigue apareciendo QR de eventos anteriores al acceder a un nuevo evento con un código diferente.

## Root Cause

En `apps/landing/app/registro/page.tsx`, la función `createTicketAndRedirect()` tenía un **early return** (líneas ~1196-1199) que redirigía a cualquier `ticketId` existente en estado sin validar que perteneciera al evento actual:

```typescript
// ❌ ANTES (línea 1196)
if (ticketId) {
  router.push(`/ticket/${ticketId}`);  // Redirige sin validar evento
  return;
}
```

### Escenario del Bug

1. Usuario con QR del evento "Love is in the Air" (event_id: xxx)
2. Accede a landing con código del evento "Carnaval 2026" (event_id: yyy)
3. Completa form y presiona "Generar QR"
4. ❌ Sistema redirige a ticket antiguo sin validar

### Por qué NO se detectó antes

- La búsqueda manual (lupa) **SÍ funcionaba** correctamente
- El backend `/api/tickets` **ya validaba** eventos correctamente
- Solo fallaba cuando usuario hacía click directo en "Generar QR" sin usar búsqueda

## Solución Implementada

### 1. Nuevo estado para trackear event_id del ticket

```typescript
const [existingTicketEventId, setExistingTicketEventId] = useState<string | null>(null);
```

### 2. Trackear event_id en `lookupDocument`

Cuando se encuentra un ticket válido para el evento actual:

```typescript
// Línea ~1180
if (ticketFromPerson && isTicketFromCurrentEvent) {
  setExistingTicketId(ticketFromPerson);
  setTicketId(ticketFromPerson);
  setExistingTicketEventId(ticketEventIdFromPerson); // ✅ NUEVO
} else if (ticketFromPerson && !isTicketFromCurrentEvent) {
  setExistingTicketId(null);
  setTicketId(null);
  setExistingTicketEventId(null); // ✅ NUEVO
}
```

### 3. Validar event_id antes de redirigir

```typescript
// Línea ~1198
async function createTicketAndRedirect(extraCodes?: string[]) {
  setError(null);
  if (extraCodes?.length) setReservationError(null);
  
  // ✅ NUEVO: Validar que el ticket sea del evento actual
  if (ticketId) {
    if (codeEventId && existingTicketEventId && existingTicketEventId !== codeEventId) {
      // Ticket es de otro evento, limpiar y continuar
      setTicketId(null);
      setExistingTicketId(null);
      setExistingTicketEventId(null);
      // No return, continuar con flujo normal
    } else {
      // Ticket válido para este evento
      router.push(`/ticket/${ticketId}`);
      return;
    }
  }
  
  // ... resto del flujo
}
```

### 4. Trackear event_id al crear ticket nuevo

```typescript
// Línea ~1262
setTicketId(data.ticketId);
setExistingTicketId(data.ticketId);
// ✅ NUEVO: Guardar event_id del ticket creado
if (data.eventId || codeEventId) {
  setExistingTicketEventId(data.eventId || codeEventId);
}
router.push(`/ticket/${data.ticketId}`);
```

### 5. Limpiar en reset

```typescript
const resetMainForm = () => {
  setForm({ ...initialFormState });
  setExistingTicketId(null);
  setTicketId(null);
  setExistingTicketEventId(null); // ✅ NUEVO
  setError(null);
  // ...
};
```

## Archivos Modificados

- `apps/landing/app/registro/page.tsx`:
  - Línea 155: Agregado estado `existingTicketEventId`
  - Línea 172: Limpiar en `resetMainForm()`
  - Línea 1180: Trackear en `lookupDocument()`
  - Línea 1198: Validar en `createTicketAndRedirect()`
  - Línea 1263: Trackear al crear ticket nuevo

## Testing

### Escenarios Validados

✅ **Escenario 1**: Usuario con ticket antiguo → código nuevo → "Generar QR"
- **Antes**: Redirige a QR antiguo
- **Ahora**: Limpia ticket antiguo, crea/muestra ticket del evento actual

✅ **Escenario 2**: Usuario con ticket antiguo → búsqueda manual
- **Antes**: ✅ Ya funcionaba
- **Ahora**: ✅ Sigue funcionando

✅ **Escenario 3**: Usuario nuevo → "Generar QR"
- **Antes**: ✅ Ya funcionaba
- **Ahora**: ✅ Sigue funcionando

✅ **Escenario 4**: Usuario con ticket actual → búsqueda
- **Antes**: ✅ Muestra "Ver mi QR"
- **Ahora**: ✅ Sigue funcionando

## Arquitectura Validada

✅ **Backend**: `/api/tickets` ya tenía validación correcta
✅ **API persons**: Ya filtraba por evento
✅ **Reservations**: Crea con event_id correcto
✅ **Scanner**: Valida por qr_token, no afectado

## Impacto

- **Users**: Ya no verán QRs de eventos anteriores
- **Performance**: Sin impacto (solo validación en memoria)
- **Breaking Changes**: Ninguno
- **Database**: Sin cambios
- **API**: Sin cambios

## Deployment

- [x] Código modificado
- [x] Tests validados
- [ ] Deploy a staging
- [ ] Validación E2E en staging
- [ ] Deploy a producción
- [ ] Monitoreo de logs

## Métricas a Monitorear

- Tasa de tickets duplicados (debe disminuir a ~0%)
- Errores en `/api/tickets` (no debe aumentar)
- Tiempo de generación de QR (no debe cambiar)

## Rollback Plan

Si falla, revertir commit con:
```bash
git revert <commit-hash>
```

No requiere migración de BD, rollback es seguro.

## Lecciones Aprendidas

1. **Early returns son riesgosos**: Validar antes de redirigir
2. **Trackear context**: Guardar metadata relevante junto al estado
3. **Validación consistente**: Aplicar misma lógica en todos los flujos
4. **Testing exhaustivo**: Probar todos los paths, no solo el feliz

## Referencias

- Auditoría completa: [AUDIT-QR-GENERATION-2026-02-09.md](./AUDIT-QR-GENERATION-2026-02-09.md)
- ADR: Strangler Pattern V1 → V2 ([ARCHITECTURE_V2.md](./ARCHITECTURE_V2.md))
- Audit anterior: [AUDIT-TICKET-VALIDATION-2026-02-09.md](./AUDIT-TICKET-VALIDATION-2026-02-09.md)
