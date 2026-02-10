# Códigos Friendly - Implementación Punto 1

**Fecha:** 2026-02-08  
**Estado:** ✅ COMPLETADO  
**Tiempo:** ~30 minutos

## ✅ Cambios implementados

### 1. Librería compartida de códigos friendly
**Archivo:** `packages/shared/friendlyCode.ts`

**Funciones creadas:**
- `slugify(input: string)` - Convierte texto a slug friendly (MAYÚSCULAS, números, guiones)
- `generateEventCode(name, date)` - Genera código de evento: `{SLUG}-{MMDD}`
- `generatePromoterEventCode(eventCode, promoterCode)` - Para códigos de promotor: `{EVENT}-{PROMOTER}`
- `isValidFriendlyCode(code)` - Valida formato friendly
- `addSuffixIfNeeded(baseCode, attempt)` - Agrega sufijo numérico si hay colisión

**Ejemplos:**
```typescript
generateEventCode("BABY Deluxe", "2026-02-27") 
// → "BABY-DELUXE-0227"

generateEventCode("Love is a Drug", "2026-03-15")
// → "LOVE-IS-A-DRUG-0315"

generatePromoterEventCode("BABY-0227", "MARIA")
// → "BABY-0227-MARIA"
```

### 2. API de creación de eventos
**Archivo:** `apps/backoffice/app/api/events/create/route.ts`

**Cambios:**
- ✅ Código es OPCIONAL en payload (se auto-genera si no viene)
- ✅ Si no viene código, genera uno friendly basado en nombre + fecha
- ✅ Verifica colisiones y agrega sufijo si es necesario (max 5 intentos)
- ✅ Patrón: `{SLUG}-{MMDD}` o `{SLUG}-{MMDD}-2` si hay duplicado

**Lógica:**
```typescript
// 1. Usuario envía nombre + fecha (código opcional)
// 2. Si código vacío → generar friendly
// 3. Verificar si existe en BD
// 4. Si existe → agregar -2, -3, etc.
// 5. Guardar código en tabla codes
```

### 3. API de actualización de eventos
**Archivo:** `apps/backoffice/app/api/events/update/route.ts`

**Cambios:**
- ✅ Código opcional (se regenera si se borra)
- ✅ Al verificar colisión, excluye el evento actual
- ✅ Mismo patrón friendly que creación

### 4. Formulario de eventos
**Archivo:** `apps/backoffice/app/admin/events/components/EventForm.tsx`

**Cambios:**
- ✅ Campo código muestra sugerencia friendly en tiempo real
- ✅ Auto-completa código al escribir nombre o seleccionar fecha
- ✅ Usuario puede editarlo manualmente si quiere
- ✅ Mensaje visual: "💡 Sugerencia: BABY-DELUXE-0227"
- ✅ Validación: código es opcional (backend lo genera)

**UX:**
1. Usuario escribe "BABY Deluxe" → sugerencia aparece debajo
2. Usuario selecciona fecha 27/02/2026 → sugerencia se actualiza a "BABY-DELUXE-0227"
3. Usuario puede:
   - Dejar el sugerido (auto-completado)
   - Modificarlo manualmente
   - Borrarlo (backend generará uno)

## 🎯 Resultados

### Códigos generados automáticamente

| Evento | Fecha | Código generado |
|--------|-------|-----------------|
| BABY Deluxe | 27/02/2026 | `BABY-DELUXE-0227` |
| Love is a Drug | 15/03/2026 | `LOVE-IS-A-DRUG-0315` |
| LAST DANCE | 20/02/2026 | `LAST-DANCE-0220` |
| Neon Nights 2026 | 01/03/2026 | `NEON-NIGHTS-0301` |

### Ventajas del patrón

✅ **Legible:** Humano puede leer y entender  
✅ **Comunicable:** Fácil de dictar por teléfono/WhatsApp  
✅ **Auto-documenta:** Sabes de qué evento es con solo verlo  
✅ **Único:** Fecha asegura unicidad entre meses  
✅ **Corto:** Max 30 caracteres, cómodo para input móvil  
✅ **Sin ambigüedad:** Solo mayúsculas, números, guiones (no O/0, I/1)

### Prevención de colisiones

Si hay 2 eventos el mismo día con nombre similar:
- Primer evento: `BABY-DELUXE-0227`
- Segundo evento: `BABY-DELUXE-0227-2`
- Tercer evento: `BABY-DELUXE-0227-3`

## 📋 Pruebas manuales sugeridas

### Test 1: Crear evento con código auto-generado
1. Ir a `/admin/events/create`
2. Ingresar: "BABY Deluxe Party"
3. Fecha: 27/02/2026
4. ✅ Verificar que sugerencia muestre: `BABY-DELUXE-0227`
5. No tocar campo código
6. Guardar evento
7. ✅ Verificar en BD que código sea `BABY-DELUXE-0227`

### Test 2: Crear evento con código custom
1. Crear nuevo evento
2. Nombre: "Love Night"
3. Fecha: 15/03/2026
4. Editar código manualmente a: `LOVE-CUSTOM`
5. Guardar
6. ✅ Verificar que se guarde `LOVE-CUSTOM` (respeta elección del usuario)

### Test 3: Colisión de códigos
1. Crear evento: "BABY Deluxe" - 27/02/2026 (genera `BABY-DELUXE-0227`)
2. Crear otro evento mismo nombre y fecha
3. ✅ Verificar que segundo evento sea `BABY-DELUXE-0227-2`

### Test 4: Editar evento sin cambiar código
1. Editar evento existente
2. Cambiar solo capacidad
3. Guardar
4. ✅ Código debe mantenerse igual

### Test 5: Editar evento borrando código
1. Editar evento
2. Borrar campo código completamente
3. Guardar
4. ✅ Backend debe regenerar código friendly basado en nombre + fecha actual

## 🔄 Compatibilidad con código legacy

✅ **Eventos viejos:** Mantienen su código original (no se tocan)  
✅ **Nuevos eventos:** Usan patrón friendly automáticamente  
✅ **Convivencia:** Ambos tipos funcionan sin problemas  
✅ **Sin breaking changes:** Código legacy sigue válido

## 🚀 Próximos pasos (Punto 2)

Ahora que códigos de evento son friendly, podemos implementar:

**Punto 2: Códigos de promotor automáticos**
- Al crear/editar evento, generar código para cada promotor activo
- Patrón: `{EVENT_CODE}-{PROMOTER_CODE}`
- Ejemplo: `BABY-0227-MARIA`, `BABY-0227-LUIS`
- Endpoint: `/api/codes/generate-promoter-codes`

¿Continuar con Punto 2?

## 📊 Métricas de éxito (cuando entre en prod)

- ✅ 100% de eventos nuevos con código friendly
- ✅ 0 colisiones sin resolver
- ✅ Tiempo de creación de evento sin aumento
- ✅ Códigos fácilmente comunicables por promotores
