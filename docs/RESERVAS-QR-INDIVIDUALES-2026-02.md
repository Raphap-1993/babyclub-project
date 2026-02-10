# FLUJO COMPLETO: RESERVAS DE MESA CON QRS INDIVIDUALES
**Fecha:** 9 de febrero de 2026  
**Decisión:** Cada persona tiene su código/QR individual

---

## 🎯 Objetivo
Cliente reserva una mesa → Recibe QRs individuales por email → Cada invitado escanea su QR en puerta

---

## 📊 Modelo de Datos

### table_reservations
```sql
- id (uuid)
- table_id (fk a tables)
- event_id (fk a events)
- customer_name (full_name del cliente principal)
- customer_email
- customer_phone
- customer_document (DNI)
- status (approved, pending, confirmed, rejected)
- voucher_url (opcional)
- notes (internas)
- created_at
```

### codes (tabla existente)
```sql
- id (uuid)
- code (string único, ej: "BC-LOVE-M1-001")
- event_id (fk a events)
- qr_token (string único para generar QR)
- table_reservation_id (fk a table_reservations) ← NUEVO CAMPO
- person_index (1, 2, 3, 4, 5) ← NUEVO CAMPO para identificar "Persona 1", "Persona 2"...
- is_used (boolean)
- used_at (timestamp)
- created_at
```

---

## 🔄 Flujo End-to-End

### 1. Admin crea reserva manual (Backoffice)
**Input:**
- Cliente: RAPHAEL HUGO PAREDES LLOCLLA
- Email: raphaelparedes2@gmail.com
- Teléfono: 998906481
- DNI: 71020150
- Evento: LOVE IS A DRUG
- Mesa: Mesa 1 (5 personas)
- Estado: Aprobada
- Voucher: (opcional)

**Backend hace:**
```typescript
// 1. Crear reserva
const reservation = await supabase.from('table_reservations').insert({
  table_id: 'mesa-1-id',
  event_id: 'love-is-a-drug-id',
  customer_name: 'RAPHAEL HUGO PAREDES LLOCLLA',
  customer_email: 'raphaelparedes2@gmail.com',
  customer_phone: '998906481',
  customer_document: '71020150',
  status: 'approved'
}).single();

// 2. Obtener ticket_count de la mesa (ej: 5)
const table = await supabase.from('tables').select('ticket_count').eq('id', table_id).single();

// 3. Generar N códigos (donde N = ticket_count)
for (let i = 1; i <= table.ticket_count; i++) {
  const code = generateFriendlyCode(event, table, i); // BC-LOVE-M1-001
  const qr_token = generateUUID(); // Para el QR
  
  await supabase.from('codes').insert({
    code: code,
    event_id: event_id,
    qr_token: qr_token,
    table_reservation_id: reservation.id,
    person_index: i,
    is_used: false
  });
}

// 4. Enviar email con QRs
await sendReservationEmail(reservation, codes);
```

---

## 🎨 Formato de Códigos Friendly

### Opción A: Por evento y mesa
```
BC-LOVE-M1-001
BC-LOVE-M1-002
BC-LOVE-M1-003
BC-LOVE-M1-004
BC-LOVE-M1-005

Formato: {PREFIJO}-{EVENTO_SLUG}-M{NUM_MESA}-{INDEX}
```

### Opción B: Por evento con contador global
```
LOVEISLOVE-001
LOVEISLOVE-002
LOVEISLOVE-003

Formato: {EVENTO_SLUG_UPPER}-{COUNTER}
```

### Opción C: Corto y memorable
```
LOVE-A1B2C3
LOVE-D4E5F6
LOVE-G7H8I9

Formato: {EVENTO_SLUG_SHORT}-{RANDOM_6_CHARS}
```

**Recomendación:** Opción A (más trazable, identifica mesa)

---

## 📧 Email Transaccional

### Plantilla HTML (Resend)
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tu Reserva - LOVE IS A DRUG</title>
</head>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  
  <!-- Header -->
  <div style="background: #000; padding: 20px; text-align: center;">
    <h1 style="color: #fff; margin: 0;">🎉 Reserva Confirmada</h1>
  </div>

  <!-- Body -->
  <div style="padding: 30px; background: #f5f5f5;">
    <h2 style="color: #333;">Hola RAPHAEL,</h2>
    <p style="color: #666;">Tu reserva de <strong>Mesa 1</strong> para el evento <strong>LOVE IS A DRUG</strong> está confirmada.</p>
    
    <div style="background: #fff; border-radius: 10px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #333; margin-top: 0;">📍 Detalles del Evento</h3>
      <p style="margin: 5px 0;">📅 <strong>Fecha:</strong> 27 de febrero de 2026</p>
      <p style="margin: 5px 0;">🕐 <strong>Hora:</strong> 10:00 PM</p>
      <p style="margin: 5px 0;">📍 <strong>Lugar:</strong> Av. Mariscal Castilla 602</p>
    </div>

    <h3 style="color: #333;">🎫 Tus Entradas (5 personas)</h3>
    <p style="color: #666; font-size: 14px;">Cada invitado debe presentar su QR en la puerta del evento</p>

    <!-- QR Cards -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 20px;">
      
      <!-- Persona 1 -->
      <div style="background: #fff; border: 2px solid #000; border-radius: 8px; padding: 15px; text-align: center;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={{qr_token_1}}" 
             alt="QR Persona 1" 
             style="width: 150px; height: 150px; margin: 10px 0;">
        <p style="margin: 5px 0; font-weight: bold; color: #000;">BC-LOVE-M1-001</p>
        <p style="margin: 5px 0; font-size: 12px; color: #666;">Persona 1</p>
      </div>

      <!-- Persona 2 -->
      <div style="background: #fff; border: 2px solid #000; border-radius: 8px; padding: 15px; text-align: center;">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data={{qr_token_2}}" 
             alt="QR Persona 2" 
             style="width: 150px; height: 150px; margin: 10px 0;">
        <p style="margin: 5px 0; font-weight: bold; color: #000;">BC-LOVE-M1-002</p>
        <p style="margin: 5px 0; font-size: 12px; color: #666;">Persona 2</p>
      </div>

      <!-- Repetir para personas 3, 4, 5 -->
      
    </div>

    <!-- Instrucciones -->
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-top: 30px;">
      <h4 style="margin-top: 0; color: #856404;">⚠️ Importante</h4>
      <ul style="color: #856404; margin: 10px 0; padding-left: 20px;">
        <li>Cada código es personal e intransferible</li>
        <li>Presenta tu QR en la puerta del evento</li>
        <li>No se permite reingreso</li>
        <li>Llega 30 minutos antes del evento</li>
      </ul>
    </div>

    <!-- CTA Button -->
    <div style="text-align: center; margin: 30px 0;">
      <a href="https://tudominio.com/mi-reserva?code=BC-LOVE-M1-001" 
         style="display: inline-block; background: #e91e63; color: #fff; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
        Ver Reserva Completa
      </a>
    </div>

  </div>

  <!-- Footer -->
  <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
    <p style="margin: 5px 0;">Baby Club - LOVE IS A DRUG</p>
    <p style="margin: 5px 0;">
      <a href="https://tudominio.com/mi-reserva" style="color: #e91e63; text-decoration: none;">Ver mis entradas</a> | 
      <a href="mailto:soporte@babyclub.pe" style="color: #999; text-decoration: none;">Soporte</a>
    </p>
  </div>

</body>
</html>
```

---

## 🌐 Landing: Vista de Reserva

### Ruta Nueva
`/mi-reserva?code={CODE}` o `/reservations/{RESERVATION_ID}`

### Diseño de Página
```
┌─────────────────────────────────────┐
│  Header de la landing               │
├─────────────────────────────────────┤
│                                     │
│  🎉 Tu Reserva - LOVE IS A DRUG     │
│                                     │
│  Cliente: RAPHAEL PAREDES           │
│  Mesa: Mesa 1 (5 personas)          │
│  Fecha: 27/02/2026                  │
│  Estado: ✅ Confirmada              │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Descarga tus QRs:          │   │
│  │                             │   │
│  │  [⬇️ Descargar PDF]         │   │
│  │  [📱 Enviar por WhatsApp]   │   │
│  └─────────────────────────────┘   │
│                                     │
│  Tus Códigos de Entrada:            │
│                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐     │
│  │ QR 1 │  │ QR 2 │  │ QR 3 │     │
│  │ M1-1 │  │ M1-2 │  │ M1-3 │     │
│  └──────┘  └──────┘  └──────┘     │
│                                     │
│  ┌──────┐  ┌──────┐                │
│  │ QR 4 │  │ QR 5 │                │
│  │ M1-4 │  │ M1-5 │                │
│  └──────┘  └──────┘                │
│                                     │
└─────────────────────────────────────┘
```

---

## 🔗 Footer de Landing Principal

### Ubicación
Al final de la primera página de la landing (home)

### Diseño Sutil
```html
<footer class="bg-slate-900 text-slate-400 py-8">
  <div class="container mx-auto px-4">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      
      <!-- Columna 1: Info -->
      <div>
        <h3 class="text-white font-bold mb-2">Baby Club</h3>
        <p class="text-sm">La mejor experiencia de eventos</p>
      </div>

      <!-- Columna 2: Links -->
      <div>
        <h4 class="text-white font-semibold mb-2">Enlaces</h4>
        <ul class="space-y-1 text-sm">
          <li><a href="/eventos" class="hover:text-pink-400">Eventos</a></li>
          <li><a href="/nosotros" class="hover:text-pink-400">Nosotros</a></li>
          <li><a href="/contacto" class="hover:text-pink-400">Contacto</a></li>
          <li>
            <a href="/mi-reserva" class="hover:text-pink-400 flex items-center gap-1">
              🎫 Ver mis entradas
            </a>
          </li>
        </ul>
      </div>

      <!-- Columna 3: Social -->
      <div>
        <h4 class="text-white font-semibold mb-2">Síguenos</h4>
        <div class="flex gap-3">
          <a href="#" class="hover:text-pink-400">📘 Facebook</a>
          <a href="#" class="hover:text-pink-400">📷 Instagram</a>
        </div>
      </div>

    </div>

    <div class="border-t border-slate-800 mt-6 pt-6 text-center text-sm">
      <p>© 2026 Baby Club. Todos los derechos reservados.</p>
    </div>
  </div>
</footer>
```

---

## 📝 Checklist de Implementación

### Backend
- [ ] Migración: Agregar campos `table_reservation_id` y `person_index` a tabla `codes`
- [ ] Función: `generateFriendlyCode(event, table, index)` → "BC-LOVE-M1-001"
- [ ] Endpoint: Actualizar `/api/admin/reservations` POST para generar N códigos
- [ ] Email: Crear plantilla HTML con QRs individuales en Resend
- [ ] Email: Generar QRs usando `https://api.qrserver.com/v1/create-qr-code/` con `qr_token`

### Frontend - Landing
- [ ] Ruta nueva: `/mi-reserva` (página de búsqueda)
- [ ] Ruta nueva: `/mi-reserva/[code]` o `/reservations/[id]` (vista de detalle)
- [ ] Componente: Mostrar QRs en grid
- [ ] Funcionalidad: Descargar PDF con todos los QRs
- [ ] Funcionalidad: Compartir por WhatsApp
- [ ] Footer: Agregar link sutil "Ver mis entradas"

### Frontend - Backoffice
- [ ] Ya está implementado ✅

### Testing
- [ ] Crear reserva manual → Verificar email con 5 QRs
- [ ] Escanear QR en `/api/scan` → Validar que funcione
- [ ] Ver reserva en landing → Verificar que muestre todos los QRs
- [ ] Descargar PDF → Verificar que contenga todos los códigos

---

## 🎯 Próximos Pasos

1. **Migración de BD** (agregar campos a `codes`)
2. **Generar códigos friendly** (función de generación)
3. **Plantilla de email** (HTML con QRs)
4. **Landing: página "Mi Reserva"**
5. **Testing completo**

---

**Estado:** 📋 Documentado - Listo para implementar
**Prioridad:** 🔥 Alta - Crítico para lanzamiento
