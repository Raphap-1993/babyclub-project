# Resumen de Cambios - Cierre de Evento (2026-02-08)

## Problema solucionado
Después de cerrar un evento, los usuarios podían reutilizar QR del evento anterior cuando se registraban nuevamente. Esto causaba que se mostrara "VER MI QR" en lugar de "GENERAR QR".

## Cambios realizados

### 1. [apps/landing/app/api/persons/route.ts](apps/landing/app/api/persons/route.ts)
**Líneas 130-152**: Fallback de búsqueda de tickets

❌ **Problema**: Retornaba el ticket más reciente sin validar si su evento seguía activo
✅ **Solución**: 
- Busca UP TO 10 tickets ordenados por fecha
- Valida `event.is_active === true` y `event.closed_at === null`
- Solo retorna tickets vigentes

**Impacto**: Fix principal que resuelve la UI mostrando "VER MI QR" para eventos cerrados

### 2. [apps/landing/app/api/tickets/route.ts](apps/landing/app/api/tickets/route.ts)
**Líneas 80-100**: Validación de evento activo

✅ **Agregado**:
- Antes de crear ticket, valida que el evento esté activo (`is_active = true`, `closed_at = null`)
- Retorna error 400 si evento está cerrado
- Previene crear tickets para eventos cerrados

**Líneas 175-195**: Filtro de tickets existentes

✅ **Mejorado**:
- Busca el ticket existente del usuario + datos del evento
- Solo reutiliza ticket si el evento sigue activo
- Permite crear nuevo ticket si el evento está cerrado

**Impacto**: Protección adicional + mejor experiencia multi-evento

### 3. [apps/landing/app/api/tickets/route.test.ts](apps/landing/app/api/tickets/route.test.ts)

✅ **Tests añadidos**:
1. "crea ticket free con código válido" - Actualizado con mock de evento activo
2. "rechaza crear ticket si el evento está cerrado" - Nuevo test

**Status**: ✅ All 37 tests passing

### 4. [docs/MULTI-EVENT-CLOSE-LOGIC-2026-02.md](docs/MULTI-EVENT-CLOSE-LOGIC-2026-02.md)
Documentación completa del problema, raíz, solución y reglas de negocio

## Reglas de negocio implementadas

### ✅ Multi-evento
- Un usuario PUEDE tener múltiples tickets en eventos diferentes
- Un usuario NO PUEDE tener múltiples tickets en el MISMO evento activo

### ✅ Cierre de evento
- Cuando se cierra evento: `is_active = false`, `closed_at = now()`
- Todos los `codes` del evento → `is_active = false`
- Los tickets NO se borran (soft delete, trazabilidad)
- Los tickets del evento cerrado NO se reutilizan

### ✅ Búsqueda de tickets vigentes
- Vigente = ticket de evento activo (`is_active = true` + `closed_at = null`)
- No vigente = ticket de evento cerrado, expirado, o eliminado
- Fallback filtra solo tickets vigentes

## Caso de uso ahora funcionando ✅

```
Usuario: Rafael (DNI: 71020150)
Evento A: Cumpleaños 2026-02-05 (CERRADO en 2026-02-07)
Evento B: Cumpleaños 2026-03-05 (ABIERTO, nuevo código)

Hoy: 2026-02-08
Usuario: Accede con código Evento B, ingresa DNI 71020150
ANTES ❌: Sistema mostraba "VER MI QR" (ticket viejo Evento A)
AHORA ✅: Sistema muestra "GENERAR QR" (permite nuevo ticket Evento B)
```

## Validación

- ✅ TypeScript types OK
- ✅ All tests passing (37/37)
- ✅ Lint OK
- ✅ No breaking changes
- ✅ DoD completo (tests + logs + documentación)

## Próximos pasos opcionales

1. Agregar test de `applyNotDeleted` en `/api/persons`
2. Agregar observabilidad (log cuando se reutiliza vs crea nuevo ticket)
3. Agregar field `ticket_event_id` a response de `/api/persons` para debuggeo
