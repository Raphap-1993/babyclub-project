# EVENT LAUNCH CHECKLIST (SIN MODULO PAGOS)

Fecha base: 2026-02-07  
Objetivo: lanzar la web del nuevo evento con flujo actual (sin Culqi habilitado).

## Decisiones de este release
- El modulo de pagos Culqi **no** se lanza hoy.
- El flujo comercial se mantiene con el proceso actual manual.
- La prioridad es estabilidad de landing publica y operacion de puerta.

## Variables de entorno (obligatorias)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ENABLE_CULQI_PAYMENTS=false`

## T-60 min (preparacion)
- Validar que el evento nuevo existe y esta activo en backoffice.
- Validar branding y layout del evento.
- Validar que existan codigos generales/especiales del evento.
- Confirmar capacidad/entry_limit configurados correctamente.

## T-40 min (smoke APIs publicas)
Ejecutar:
```bash
bash scripts/smoke-public-api.sh "https://babyclubaccess.com" "CODIGO_DE_PRUEBA"
```

Debe pasar:
- `GET /api/events`
- `GET /api/branding`
- `GET /api/layout`
- `GET /api/codes/info?code=...`
- `GET /api/aforo?code=...`

## T-25 min (smoke funcional manual)
- Flujo web:
  - `/` -> manifiesto -> registro
  - validacion de datos y creacion de ticket
  - visualizacion de ticket QR
- Flujo puerta:
  - escaneo QR valido
  - bloqueo de duplicado/reingreso
  - validacion de limite horario para codigo general

## T-15 min (observabilidad)
- Revisar logs de errores en Vercel.
- Revisar tablas de trazabilidad en Supabase:
  - `scan_logs`
  - `process_logs`

## T-10 min (Go/No-Go)
GO si:
- landing responde estable
- flujo de registro funciona
- escaneo funciona en <= 2s

NO-GO si:
- hay fallas recurrentes 5xx en APIs publicas
- fallan escaneos validos o duplica ingresos
- no hay trazabilidad minima de errores

## Rollback rapido
- Revertir deploy en Vercel al ultimo release estable.
- Mantener operacion de puerta en modo manual temporal segun protocolo interno.
- Congelar cambios no criticos hasta estabilizar.

## Post-launch (T+20 min)
- Repetir smoke APIs.
- Confirmar primeras altas de tickets y escaneos correctos.
- Registrar incidencias y decisiones en `docs/AUDIT-2026-02.md`.
