# Auditoría: Validación de Tickets por Evento (2026-02-09)

## Problema reportado
Usuario ve "VER MI QR" con información de una reserva antigua (diferente mesa, productos de otro evento) cuando accede a la página de registro.

## Diagnóstico

### Race Condition identificada

**Flujo incorrecto (antes del fix):**
```
T0: Component mount → codeEventId = null
T1: useEffect() inicia carga async de /api/codes/info
T2: Usuario escribe DNI → useEffect([form.document]) ejecuta loadPersonData()
T3: loadPersonData() consulta /api/persons con codeEventId = null
T4: /api/persons devuelve ticket de evento anterior (activo, no cancelado)
T5: Validación: (!null || ticketEventId === codeEventId) 
    → (!null || '123' === null) → TRUE ✅ (FALSO POSITIVO)
T6: setExistingTicketId(ticket_antiguo) → muestra "VER MI QR" ❌
T7: /api/codes/info termina (demasiado tarde) → setCodeEventId(real_event_id)
```

**Problema central**: La validación del evento ocurría con `codeEventId = null` porque la carga del código es asíncrona.

### Código problemático

**Antes (línea 1139):**
```typescript
if (ticketFromPerson && (!codeEventId || ticketEventIdFromPerson === codeEventId)) {
  setExistingTicketId(ticketFromPerson);
  setTicketId(ticketFromPerson);
}
```
- `!codeEventId` era `true` durante la carga
- Aceptaba cualquier ticket mientras codeEventId fuera null

**useEffect sin dependencia de codeEventId (línea 225):**
```typescript
useEffect(() => {
  if (validateDocument(form.doc_type, form.document)) {
    loadPersonData(form.document, { docType: form.doc_type });
  }
}, [form.doc_type, form.document]); // ❌ Falta codeEventId
```

## Solución implementada

### 1. Agregar codeEventId como dependencia
```typescript
useEffect(() => {
  if (validateDocument(form.doc_type, form.document)) {
    loadPersonData(form.document, { docType: form.doc_type });
  }
}, [form.doc_type, form.document, codeEventId]); // ✅ Agregado codeEventId
```

**Efecto**: 
- Primera ejecución: codeEventId = null → consulta /api/persons
- Segunda ejecución: codeEventId cargado → re-consulta con validación correcta
- El cache key evita llamadas duplicadas innecesarias

### 2. Mejorar cache key para incluir evento
```typescript
const cacheKey = `${docType}:${dni}:${codeEventId || 'no-event'}`;
if (!opts.force && lastPersonLookup.current === cacheKey) return;
lastPersonLookup.current = cacheKey;
```

**Efecto**:
- Primera llamada: `dni:71020150:no-event` → no está en cache, ejecuta
- Segunda llamada: `dni:71020150:event_abc123` → diferente key, re-ejecuta
- Tercera llamada: `dni:71020150:event_abc123` → mismo key, skip

### 3. Limpiar tickets de otros eventos
```typescript
const isTicketFromCurrentEvent = !codeEventId || ticketEventIdFromPerson === codeEventId;

if (ticketFromPerson && isTicketFromCurrentEvent) {
  setExistingTicketId(ticketFromPerson);
  setTicketId(ticketFromPerson);
} else if (ticketFromPerson && !isTicketFromCurrentEvent) {
  // Limpiar ticket antiguo si es de otro evento
  setExistingTicketId(null);
  setTicketId(null);
}
```

**Efecto**:
- Si el ticket es de otro evento, se limpia explícitamente
- Previene que quede en estado residual

## Flujo corregido (después del fix)

```
T0: Component mount → codeEventId = null
T1: useEffect() inicia /api/codes/info (async)
T2: Usuario escribe DNI → useEffect([document, codeEventId=null]) ejecuta
T3: loadPersonData() consulta /api/persons (cache: dni:71020150:no-event)
T4: /api/persons devuelve ticket antiguo
T5: Validación: (!null || ...) → TRUE, acepta temporalmente
T6: /api/codes/info termina → setCodeEventId('event_abc123')
T7: useEffect se re-ejecuta porque codeEventId cambió ✅
T8: loadPersonData() consulta /api/persons (cache: dni:71020150:event_abc123) ✅
T9: /api/persons devuelve mismo ticket
T10: Validación: (!false || 'old_event' === 'event_abc123') → FALSE ❌
T11: Entra en else: setExistingTicketId(null), setTicketId(null) ✅
T12: UI muestra "GENERAR QR" correctamente ✅
```

## Archivos modificados

1. **apps/landing/app/registro/page.tsx**
   - Línea 139: Agregado estado `codeEventId`
   - Línea 225: Agregado `codeEventId` a dependencias del useEffect
   - Línea 231: Agregado `codeEventId` a dependencias del useEffect (reservation)
   - Línea 304: Guardar `event_id` al cargar `/api/codes/info`
   - Línea 1095: Cache key incluye `codeEventId`
   - Línea 1139-1146: Validación mejorada con limpieza explícita

## Testing

### Casos de prueba
1. ✅ Usuario con ticket antiguo de evento A, accede con código de evento B → muestra "GENERAR QR"
2. ✅ Usuario con ticket actual de evento A, accede con código de evento A → muestra "VER MI QR"
3. ✅ Usuario sin tickets, accede con código de evento A → muestra "GENERAR QR"
4. ✅ Usuario con ticket de evento A, accede sin código → muestra "VER MI QR" (legacy)

### Verificación manual
1. Recargar página con URL tipo `localhost:3001?code=XXXX`
2. Ingresar DNI de usuario con ticket antiguo
3. Esperar a que cargue `/api/codes/info` (visible en Network tab)
4. Verificar que después de 1-2 segundos, el estado se actualiza
5. Confirmar que muestra "GENERAR QR" en lugar de "VER MI QR"

## Lecciones aprendidas

1. **Race conditions con async state**: Siempre incluir estados async como dependencias de useEffect
2. **Cache keys inteligentes**: Incluir todos los factores relevantes en el cache key
3. **Validación defensiva**: No solo verificar condiciones positivas, sino también limpiar estados negativos
4. **Debugging de timing**: Las race conditions se manifiestan cuando el usuario es rápido

## Próximos pasos (opcional)

### Optimización adicional
- [ ] Agregar loading state mientras codeEventId es null
- [ ] Mostrar mensaje "Validando evento..." durante la segunda consulta
- [ ] Considerar usar React Query o SWR para manejar cache automático
- [ ] Agregar telemetría para medir cuántas veces ocurre la doble consulta

### Monitoreo
- [ ] Log cuando se detecta ticket de otro evento
- [ ] Métrica: % de usuarios que intentan acceder con tickets antiguos
- [ ] Alert si hay muchos casos de validación fallida

## Referencias
- Issue: "me sigue mostrando mi qr de una reserva antigua"
- Código afectado: apps/landing/app/registro/page.tsx
- API involucrada: /api/persons, /api/codes/info
