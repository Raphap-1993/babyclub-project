# AUDITORÍA: Problema de múltiples correos en reservas
**Fecha**: 2026-02-09  
**Severidad**: 🔴 CRÍTICA  
**Impacto**: Mala experiencia del cliente (reciben 6+ correos por una sola reserva)

---

## 🐛 PROBLEMA REPORTADO

**Síntoma**: Cuando un cliente reserva una mesa con producto desde el landing, recibe **múltiples correos** (hasta 6) en lugar de uno solo consolidado.

**Ejemplo**: Cliente "Lorena Pelaez Bardales" reservó mesa 1 (5 entradas) y recibió 6 correos diferentes.

---

## 🔍 ANÁLISIS ROOT CAUSE

### **Flujo actual (INCORRECTO)**

1. **Landing**: Cliente reserva mesa + producto (ej: Mesa 1 con 5 entradas)
   - Endpoint: `POST /api/reservations`
   - Se crea 1 registro en `table_reservations` con `ticket_quantity = 5`
   - Se generan códigos promocionales para la mesa

2. **Backoffice**: Admin aprueba la reserva
   - Endpoint: `POST /api/reservations/update` (status = "approved")
   - **PROBLEMA AQUÍ** → Línea 142-145 de `update/route.ts`:
   
```typescript
for (let i = 0; i < ticketQuantity; i++) {
  const result = await createTicketForReservation(supabase, {...});
  ticketResults.push(result);
}
```

   - **Se crean N tickets** (uno por cada entrada incluida)
   - **PROBLEMA AQUÍ** → Línea 161-167:

```typescript
for (const ticketId of ticketIds) {
  try {
    await sendTicketEmail({ supabase, ticketId, toEmail: resolvedEmail });
  } catch (err: any) {
    ticketEmailError = err?.message;
  }
}
```

   - **Se envía 1 correo por cada ticket** ❌
   - Además se envía **1 correo adicional de aprobación** (línea 173-182)

### **Resultado**: 
- Mesa con 5 entradas → 5 correos de ticket + 1 de aprobación = **6 correos** 📧📧📧📧📧📧

---

## ❌ PROBLEMAS ARQUITECTÓNICOS IDENTIFICADOS

### **1. Concepto erróneo: "1 ticket = 1 entrada individual"**

**Incorrecto**:
- Se crea 1 ticket por cada entrada incluida en la mesa
- Cada ticket genera un QR individual
- Cada ticket envía un correo separado

**Correcto debería ser**:
- 1 reserva de mesa → **1 ticket** con todos los QR/códigos incluidos
- O crear tickets individuales pero **consolidar el envío de correos**

### **2. Lógica duplicada de envío de correos**

En `update/route.ts` se envían:
1. **N correos individuales** (línea 161-167): uno por ticket con `sendTicketEmail()`
2. **1 correo de aprobación** (línea 173-182): con `sendApprovalEmail()`

Esto resulta en **redundancia total** → el cliente recibe información repetida.

### **3. No hay consolidación de QR codes**

Cada ticket tiene su propio QR individual, pero en reservas de mesa todos los QR deberían estar **en un solo correo consolidado**.

---

## ✅ SOLUCIÓN PROPUESTA

### **Opción A: Un solo correo consolidado (RECOMENDADA)**

**Cambios en** `/apps/backoffice/app/api/reservations/update/route.ts`:

```typescript
// ELIMINAR el loop que envía correos individuales (líneas 161-167)
// DEJAR SOLO el correo de aprobación con toda la info

if (updateData.status === "approved") {
  // 1. Crear todos los tickets SIN enviar correos individuales
  const ticketResults: Array<{ ticketId: string; code: string }> = [];
  for (let i = 0; i < ticketQuantity; i++) {
    const reuseCodes = i === 0 ? codesList : [];
    const result = await createTicketForReservation(supabase, {
      eventId,
      tableName,
      fullName: resolvedFullName,
      email: resolvedEmail,
      phone: resolvedPhone,
      docType: resolvedDocType,
      document: resolvedDocument,
      promoterId: (reservation as any).promoter_id || null,
      reuseCodes,
    });
    ticketResults.push(result);
  }

  const ticketIds = ticketResults.map((t) => t.ticketId).filter(Boolean);
  const ticketCodes = ticketResults.map((t) => t.code).filter(Boolean);
  
  // 2. Actualizar reserva con primer ticket
  if (ticketIds.length > 0) {
    await supabase.from("table_reservations").update({
      ticket_id: ticketIds[0],
      codes: ticketCodes.length > 0 ? ticketCodes : codesList,
    }).eq("id", id);
  }

  // 3. ENVIAR UN SOLO CORREO CONSOLIDADO con todos los tickets/QR
  if (isTableReservation) {
    const codesForEmail = Array.from(new Set([...(codesList || []), ...ticketCodes].filter(Boolean)));
    const eventData = eventRel || eventDirectRel || null;
    
    await sendConsolidatedReservationEmail({
      supabase,
      id,
      full_name: resolvedFullName,
      email: resolvedEmail,
      phone: resolvedPhone || null,
      codes: codesForEmail,
      tableName,
      event: eventData,
      ticketIds, // ← NUEVO: pasar todos los IDs de tickets
      productName: productRel?.name || null,
    });
    
    emailSent = true;
  }
}
```

**Crear nueva función** `sendConsolidatedReservationEmail()` que:
- Incluya link a **todos los tickets** generados
- Muestre **todos los QR codes** en un solo correo
- Incluya información del producto/pack
- Sea visualmente claro y organizado

---

### **Opción B: Ticket único con múltiples QR (ALTERNATIVA)**

En lugar de crear N tickets, crear **1 solo ticket** que contenga:
- Campo `qr_codes: string[]` con array de códigos QR
- Campo `quantity: number` 
- Lógica de escaneo que valide cada QR por separado

**Ventajas**:
- Más simple conceptualmente
- 1 correo = 1 ticket = N QR codes
- Menos registros en BD

**Desventajas**:
- Requiere cambios en el modelo de datos
- Requiere cambios en el escáner QR
- Mayor riesgo de regresión

---

## 🎯 PLAN DE IMPLEMENTACIÓN (Opción A)

### **Fase 1: Fix inmediato (1-2 horas)**

1. ✅ **Comentar el loop de correos individuales** (líneas 161-167)
2. ✅ **Mejorar `sendApprovalEmail()`** para incluir:
   - Links a todos los tickets generados
   - Todos los QR codes
   - Info del producto

### **Fase 2: Template mejorado (2-3 horas)**

1. ✅ Crear `sendConsolidatedReservationEmail()` con HTML mejorado
2. ✅ Incluir sección "Tus entradas" con lista de tickets
3. ✅ Incluir sección "Códigos QR" con todos los QR
4. ✅ Incluir información del pack/producto
5. ✅ Testing con reservas reales

### **Fase 3: Validación (30 min)**

1. ✅ Crear reserva de prueba con 5 entradas
2. ✅ Aprobar desde backoffice
3. ✅ Verificar que se recibe **1 solo correo**
4. ✅ Verificar que incluye todos los tickets/QR
5. ✅ Testing en producción con evento real

---

## 📋 CHECKLIST DE VALIDACIÓN

- [ ] Cliente recibe 1 solo correo por reserva aprobada
- [ ] Correo incluye todos los QR/códigos generados
- [ ] Correo incluye información del producto/pack
- [ ] Correo incluye links funcionales a todos los tickets
- [ ] No se pierden datos en el proceso
- [ ] Logs adecuados para debugging
- [ ] Rollback plan documentado

---

## 🚨 RIESGOS

1. **Bajo**: Cambio localizado en un endpoint
2. **Medio**: Necesita validación con reservas existentes
3. **Bajo**: Template de correo puede necesitar ajustes

---

## 📊 MÉTRICAS DE ÉXITO

**Antes**:
- Mesa con N entradas → N+1 correos enviados
- Tasa de confusión del cliente: ALTA

**Después**:
- Mesa con N entradas → **1 correo** enviado
- Tasa de confusión del cliente: BAJA
- Satisfacción del cliente: ⬆️

---

## 🔗 ARCHIVOS AFECTADOS

### **Cambios necesarios**:
1. `/apps/backoffice/app/api/reservations/update/route.ts` (líneas 135-182)
2. `/apps/backoffice/app/api/reservations/email.ts` (nueva función o mejora de existente)

### **Archivos de referencia**:
- `/apps/backoffice/app/api/admin/reservations/route.ts` (función `sendReservationEmail`)
- `/apps/landing/app/api/reservations/route.ts` (creación de reservas)
- `/apps/landing/app/compra/page.tsx` (UI de reservas)

---

## 💡 RECOMENDACIONES ADICIONALES

1. **Agregar flag de control**: `email_sent: boolean` en `table_reservations` para evitar doble envío
2. **Log consolidado**: Agregar `process_logs` entry para cada correo de reserva
3. **Unificación futura**: Considerar consolidar `/api/reservations/update` y `/api/admin/reservations` (tienen lógica duplicada)
4. **Template centralizado**: Mover templates de email a `shared/email/templates/`

---

## ⏱️ ESTIMACIÓN DE TIEMPO

- **Fix rápido (comentar loop)**: 15 minutos
- **Template mejorado**: 2-3 horas
- **Testing completo**: 30-60 minutos
- **Deploy + validación**: 30 minutos

**Total**: ~4 horas para solución completa y validada

---

## 📝 NOTAS FINALES

Este problema afecta **directamente la experiencia del cliente** y debe ser prioridad alta. La solución propuesta es quirúrgica y de bajo riesgo, pero requiere validación cuidadosa antes de deploy a producción.

**Estado**: ⚠️ PENDIENTE IMPLEMENTACIÓN  
**Prioridad**: 🔴 ALTA  
**Owner**: Equipo de desarrollo
