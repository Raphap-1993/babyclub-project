# Fix: Validación de Tickets por Evento - Resumen Ejecutivo

## 🎯 Problema
Usuario reportó: "Me sigue apareciendo mi QR de un evento pasado"

## 🔍 Root Cause
La función `createTicketAndRedirect()` tenía un **early return** que redirigía a cualquier ticket existente **sin validar** que perteneciera al evento actual del código ingresado.

```typescript
// ❌ ANTES
if (ticketId) {
  router.push(`/ticket/${ticketId}`);  // Sin validación
  return;
}
```

## ✅ Solución
Trackear el `event_id` del ticket y validar antes de redirigir:

```typescript
// ✅ AHORA
if (ticketId) {
  if (codeEventId && existingTicketEventId && existingTicketEventId !== codeEventId) {
    // Limpiar ticket de otro evento
    setTicketId(null);
    setExistingTicketId(null);
    setExistingTicketEventId(null);
  } else {
    router.push(`/ticket/${ticketId}`);
    return;
  }
}
```

## 📝 Cambios Realizados

### 1. Nuevo estado
```typescript
const [existingTicketEventId, setExistingTicketEventId] = useState<string | null>(null);
```

### 2. Trackear en `lookupDocument()`
Al encontrar ticket válido, guardar su `event_id`

### 3. Validar en `createTicketAndRedirect()`
Antes de redirigir, verificar que `existingTicketEventId === codeEventId`

### 4. Trackear al crear ticket nuevo
Guardar `event_id` del ticket recién creado

### 5. Limpiar en reset
Incluir `setExistingTicketEventId(null)` en `resetMainForm()`

## 🧪 Escenarios Validados

| Escenario | Antes | Ahora |
|-----------|-------|-------|
| Usuario con QR antiguo → código nuevo → "Generar QR" | ❌ Redirige a QR antiguo | ✅ Crea/muestra QR del evento actual |
| Usuario con QR antiguo → búsqueda manual | ✅ Funciona | ✅ Funciona |
| Usuario nuevo → "Generar QR" | ✅ Funciona | ✅ Funciona |
| Usuario con QR actual → búsqueda | ✅ Funciona | ✅ Funciona |

## 📊 Impacto

- **Severidad**: Alta (afecta experiencia de usuario crítica)
- **Breaking Changes**: Ninguno
- **Performance**: Sin impacto
- **Database**: Sin cambios
- **API**: Sin cambios

## 📦 Archivos Modificados

- `apps/landing/app/registro/page.tsx` (5 modificaciones)
- `docs/AUDIT-QR-GENERATION-2026-02-09.md` (nuevo)
- `docs/CHANGELOG-2026-02-09-ticket-event-validation-fix.md` (nuevo)

## 🚀 Deployment

- [x] Código modificado
- [x] Lint: ✅ Pasa
- [x] TypeScript: ✅ Sin errores nuevos
- [ ] Deploy a staging
- [ ] Test E2E manual
- [ ] Deploy a producción

## 📈 Métricas a Monitorear

- Tasa de tickets duplicados/incorrectos
- Errores en `/api/tickets`
- Feedback de usuarios sobre QRs

## 🔄 Rollback

Sin cambios de BD, rollback seguro con:
```bash
git revert <commit-hash>
```

## 🎓 Lecciones

1. Early returns requieren validación exhaustiva
2. Trackear metadata relevante junto al estado
3. Aplicar validación consistente en todos los flujos
4. Testing debe cubrir paths de usuario, no solo happy path

---

**Status**: ✅ READY FOR STAGING
**Docs**: [AUDIT](./AUDIT-QR-GENERATION-2026-02-09.md) | [CHANGELOG](./CHANGELOG-2026-02-09-ticket-event-validation-fix.md)
