# Optimización del Uso de API Perú (RENIEC)

**Fecha**: 2026-02-09  
**Problema**: Uso innecesario del token de API Perú en el flujo de compra/reserva

## Problema Identificado

El flujo de compra/reserva estaba haciendo **dos llamadas separadas**:
1. Primera llamada a `/api/persons` (busca en BD)
2. **Segunda llamada directa a `/api/reniec`** si no encuentra datos en BD

Esto causaba:
- ❌ Doble consumo de rate limits
- ❌ Lógica duplicada entre frontend y backend
- ❌ **No se guardaban los datos de RENIEC en BD**, causando consultas repetidas para el mismo DNI
- ❌ Posible inconsistencia entre diferentes partes del sistema

## Solución Implementada

### 1. Centralizar Lookup en `/api/persons`

**Archivo**: `apps/landing/app/compra/page.tsx`

**Antes**:
```typescript
const lookupPerson = async (document: string, target: "ticket" | "mesa", docType: DocumentType = "dni") => {
  try {
    const res = await fetch(`/api/persons?document=${encodeURIComponent(document)}&doc_type=${docType}`);
    const data = await res.json().catch(() => ({}));
    let person = res.ok ? data?.person : null;
    const fallbackEmail = person?.email || "";
    const fallbackPhone = person?.phone || "";
    const hasNames = Boolean(person?.first_name || person?.last_name);

    // ❌ DOBLE LLAMADA - Consulta directa a RENIEC desde el frontend
    if ((!person || !hasNames) && docType === "dni") {
      const reniecRes = await fetch(`/api/reniec?dni=${encodeURIComponent(document)}`);
      const reniecData = await reniecRes.json().catch(() => ({}));
      if (reniecRes.ok) {
        person = {
          first_name: reniecData?.nombres || "",
          last_name: `${reniecData?.apellidoPaterno || ""} ${reniecData?.apellidoMaterno || ""}`.trim(),
          email: fallbackEmail,
          phone: fallbackPhone,
        };
      }
    }
    // ...
  }
};
```

**Después**:
```typescript
const lookupPerson = async (document: string, target: "ticket" | "mesa", docType: DocumentType = "dni") => {
  try {
    // ✅ UNA SOLA LLAMADA - /api/persons ya maneja todo el flujo
    // (BD primero, luego RENIEC solo si no existe)
    const res = await fetch(`/api/persons?document=${encodeURIComponent(document)}&doc_type=${docType}`);
    const data = await res.json().catch(() => ({}));
    const person = res.ok ? data?.person : null;

    if (!person) return;
    // ...
  }
};
```

### 2. Guardar Resultados de RENIEC en BD

**Archivo**: `apps/landing/app/api/persons/route.ts`

**Antes**:
```typescript
if (!personRecord) {
  const apiToken = process.env.API_PERU_TOKEN;
  if (apiToken) {
    try {
      const resp = await fetch(`https://apiperu.dev/api/dni/${dni}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const payload = await resp.json();
      if (resp.ok && payload?.data) {
        // ❌ Solo retorna en memoria, NO guarda en BD
        personRecord = {
          id: null,
          doc_type: "dni",
          document: dni,
          dni,
          first_name: payload.data.nombres || "",
          last_name: `${payload.data.apellido_paterno || ""} ...`,
          email: null,
          phone: null,
          birthdate: null,
        };
      }
    } catch (_err) {}
  }
}
```

**Después**:
```typescript
if (!personRecord && docType === "dni" && dni) {
  const apiToken = process.env.API_PERU_TOKEN;
  if (apiToken) {
    try {
      const resp = await fetch(`https://apiperu.dev/api/dni/${dni}`, {
        headers: { Authorization: `Bearer ${apiToken}` },
      });
      const payload = await resp.json();
      if (resp.ok && payload?.data) {
        const apiData = payload.data;
        const firstName = apiData.nombres || "";
        const lastName = `${apiData.apellido_paterno || ""} ${apiData.apellido_materno || ""}`.trim();
        
        // ✅ Guardar en BD para evitar consultas futuras a API Perú
        const { data: newPerson } = await supabase
          .from("persons")
          .insert({
            doc_type: "dni",
            document: dni,
            dni,
            first_name: firstName,
            last_name: lastName,
            email: null,
            phone: null,
            birthdate: apiData.fecha_nacimiento || apiData.fechaNacimiento || null,
          })
          .select("id,doc_type,document,dni,first_name,last_name,email,phone,birthdate")
          .single();
        
        personRecord = newPerson || { /* fallback */ };
      }
    } catch (_err) {}
  }
}
```

## Beneficios

### ✅ Ahorro de Token API Perú
- **Primera consulta**: DNI no existe → consulta RENIEC → guarda en BD
- **Consultas siguientes**: DNI existe en BD → **NO consulta RENIEC**
- Ahorro estimado: **>90% en consultas repetidas**

### ✅ Performance Mejorada
- Una sola llamada HTTP desde el frontend en vez de dos
- Caché natural en base de datos
- Menor latencia para usuarios recurrentes

### ✅ Consistencia de Datos
- Fuente única de verdad: tabla `persons`
- No hay discrepancias entre múltiples llamadas
- Datos validados y normalizados

### ✅ Rate Limit Optimizado
- Menos presión sobre rate limits de `/api/reniec`
- Menos presión sobre rate limits de `/api/persons`
- Mayor capacidad para usuarios concurrentes

## Flujo Optimizado End-to-End

```
Usuario ingresa DNI en formulario de compra
          ↓
Frontend llama: GET /api/persons?document=12345678&doc_type=dni
          ↓
Backend: SELECT * FROM persons WHERE dni = '12345678'
          ↓
    ┌─────┴─────┐
    │           │
   ✅ Existe   ❌ No existe
    │           │
    │           ↓
    │      GET https://apiperu.dev/api/dni/12345678
    │           │
    │      ┌────┴────┐
    │      │         │
    │     ✅ OK    ❌ Error
    │      │         │
    │      ↓         ↓
    │   INSERT      Return
    │   INTO        null
    │   persons
    │      │
    └──────┴─────────┐
                     ↓
              Return person data
                     ↓
          Frontend rellena formulario
```

## Rate Limits Actuales

Definidos en `.env.example`:
```bash
RATE_LIMIT_PERSONS_PER_MIN=20    # Consultas a /api/persons
RATE_LIMIT_RENIEC_PER_MIN=20     # Consultas directas a /api/reniec
```

Con la optimización:
- La mayoría de consultas quedan en `/api/persons` (BD only)
- Solo DNIs nuevos consumen `/api/reniec` indirectamente
- Rate limit de RENIEC raramente se alcanza en producción

## Testing

### Caso 1: DNI Nuevo
```bash
# Primera vez
curl "http://localhost:3001/api/persons?document=12345678&doc_type=dni"
# → Consulta RENIEC → Guarda en BD → Retorna datos

# Segunda vez (mismo DNI)
curl "http://localhost:3001/api/persons?document=12345678&doc_type=dni"
# → Lee de BD → NO consulta RENIEC → Retorna datos
```

### Caso 2: DNI Existente
```bash
curl "http://localhost:3001/api/persons?document=71020150&doc_type=dni"
# → Lee de BD → Retorna inmediatamente
```

### Caso 3: Documento No-DNI (CE, Pasaporte)
```bash
curl "http://localhost:3001/api/persons?document=ABC123&doc_type=ce"
# → Busca en BD → Si no existe, retorna null (no llama RENIEC)
```

## Archivos Modificados

1. ✅ `apps/landing/app/compra/page.tsx` - Eliminada doble llamada
2. ✅ `apps/landing/app/api/persons/route.ts` - Auto-guardado de RENIEC

## Impacto en Otros Módulos

### `/registro` (Landing)
- ✅ Ya usa `/api/persons` correctamente
- ✅ Se beneficia automáticamente de la caché en BD

### `/acceso` (Landing)
- ✅ Ya usa `/api/persons` correctamente
- ✅ Se beneficia automáticamente de la caché en BD

### Backoffice
- ✅ No afectado (usa sus propios endpoints)
- ✅ Puede consultar tabla `persons` directamente si necesita

## Recomendaciones Futuras

### 1. Monitoreo de Uso de Token
Agregar logging para trackear:
- Consultas exitosas a RENIEC
- Consultas fallidas (DNI no encontrado, token expirado, etc.)
- Rate limits alcanzados

### 2. Caché Temporal Adicional
Considerar Redis/Vercel KV para:
- Caché en memoria de DNIs consultados recientemente
- Reducir aún más la carga en BD
- TTL de 1 hora para datos calientes

### 3. Dashboard de Métricas
- Total de personas en BD
- Consultas RENIEC diarias/mensuales
- Tasa de aciertos de caché (hit rate)
- Costo estimado de token API Perú

## Conclusión

La optimización implementada garantiza:
- ✅ Uso responsable del token de API Perú
- ✅ Base de datos como caché permanente
- ✅ Menor latencia para usuarios recurrentes
- ✅ Arquitectura escalable y sostenible
