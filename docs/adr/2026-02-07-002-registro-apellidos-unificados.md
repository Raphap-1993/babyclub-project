# ADR 2026-02-07-002: Registro con campo unico de apellidos

## Estado
Aprobado

## Contexto
En `apps/landing/app/registro/page.tsx` la UI pedia:
- apellido paterno
- apellido materno

El flujo UX requerido ahora pide un solo campo visible de apellidos, pero la persistencia actual y APIs mantienen:
- `apellido_paterno`
- `apellido_materno`

No se desea cambiar esquema de BD en esta iteracion.

## Decision
Se adopta una estrategia de **campo unico en UI + particion deterministica en frontend**:

- Campo visible: `Apellidos`.
- Regla de particion:
  - 1 palabra: `paterno=palabra`, `materno=""`
  - 2+ palabras: `materno=ultima palabra`, `paterno=resto`

Ejemplo:
- `Perez Gomez` -> paterno `Perez`, materno `Gomez`
- `De la Cruz Gomez` -> paterno `De la Cruz`, materno `Gomez`

## Consecuencias
### Positivas
- UX mas simple y rapida en registro.
- Compatibilidad total con contratos y BD actuales.
- No requiere migraciones de datos para este hito.

### Riesgos
- Casos ambiguos de apellidos compuestos maternos pueden partirse de forma no ideal.
- La calidad final depende de como el usuario escriba apellidos.

## Rollback
- Volver a dos campos visibles (`apellido_paterno` y `apellido_materno`) sin tocar BD.
- Mantener helper de concatenacion solo para visualizacion si se requiere.
