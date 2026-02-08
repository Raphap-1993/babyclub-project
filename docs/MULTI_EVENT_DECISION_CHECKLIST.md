# Checklist de Decisión: Multi-Evento + Mesas

**Reunión**: PM + Arquitecto + Tech Lead  
**Fecha**: ___________  
**Facilitador**: ___________

---

## PARTE 1: Validar Necesidad de Negocio (PM Lidera)

### Operación Esperada
- [ ] ¿Necesitamos **eventos simultaneos** (mismo horario, diferente salón)?
  - [ ] SÍ → requiere mesas independientes por evento
  - [ ] NO → eventos secuenciales (OK con Opción A)

- [ ] ¿Un evento puede tener **múltiples croquis** (ej: Salón A, Salón B)?
  - [ ] SÍ → cada salón es sub-evento o instancia
  - [ ] NO → un croquis por evento alcanza

- [ ] ¿Necesitamos **alianzas entre organizadores**?
  - [ ] SÍ → necesitan compartir croquis / mesas
  - [ ] NO → cada organizador tiene su espacio

- [ ] ¿Esperamos **reutilizar distribuciones** entre eventos?
  - [ ] SÍ → podrían clonar layouts
  - [ ] NO → crear nuevo cada vez es aceptable

### Timeline Requerido
- [ ] ¿Cuándo necesitamos estar operativos con multi-evento?
  - **Fecha**: ___________
  - [ ] Inmediato (este sprint)
  - [ ] Corto plazo (próximas 2 semanas)
  - [ ] Mediano plazo (próximo mes)
  - [ ] Futuro (cuando surja la necesidad)

### Restricciones Comerciales
- [ ] ¿Hay contratos ya firmados con cláusulas de "eventos personalizados"?
  - [ ] SÍ → → necesita diseño específico
  - [ ] NO → podemos iterar

- [ ] ¿Los clientes esperan ver "su" croquis o les importa que sea genérico?
  - [ ] Personalizado (importante) → Opción A + custom per event
  - [ ] Genérico (no importa) → Opción A simple

---

## PARTE 2: Decisión de Arquitectura (Arquitecto Lidera)

### Modelo de Datos Elegido
Basándote en el análisis de `MULTI_EVENT_LAYOUT_DESIGN.md`:

```
[ ] Opción A: Layouts por Evento (RECOMENDADA)
    - event_layouts tabla (1 layout por event_id)
    - Mesas ya tienen event_id, solo mejora filtros
    - Complejidad: BAJA
    - Costo: ~2-3 días
    
[ ] Opción B: Mesas Templadas + Layout Global
    - Nuevas tablas: table_templates, table_event_layouts
    - Reutiliza plantillas entre eventos
    - Complejidad: MEDIA
    - Costo: ~4-5 días
    
[ ] Opción C: Layouts por Organizador
    - organizer_layouts, organizer_layout_mesas
    - Organizador controla su identidad
    - Complejidad: ALTA
    - Costo: ~6-8 días
```

**Opción elegida**: [ ] A [ ] B [ ] C  
**Justificación**:  
_________________________________________________________________  
_________________________________________________________________

### Seguridad y RLS
- [ ] ¿El filtro debe ser solo por `event_id`?
  - [ ] SÍ (recomendado)
  - [ ] NO, también por `organizer_id` (multi-org)

- [ ] ¿Un promotor de Org A puede ver mesas de Org B?
  - [ ] No (recomendado)
  - [ ] Sí, con restricciones especiales

- [ ] ¿Soft delete en event_layouts?
  - [ ] Sí (auditoría)
  - [ ] No (simplificar)

### Scope de Cambios
- [ ] ¿Modificamos `layout_settings` o creamos tabla nueva?
  - [ ] Modificar existente
  - [ ] Nueva tabla `event_layouts`
  - [ ] Ambas en paralelo (migración segura)

- [ ] ¿Versionamos croquis (v1, v2, v3)?
  - [ ] Sí (auditoría, rollback)
  - [ ] No (simplificar)

- [ ] ¿Requerimos clonar/copiar layouts entre eventos?
  - [ ] Sí (feature)
  - [ ] No (MVP simple)

---

## PARTE 3: Definir Permisos (Arquitecto + PM)

### Quién Puede Hacer Qué

| Rol | Ver Croquis | Editar Posiciones | Subir Croquis | Ver Otros Eventos |
|-----|-------------|-------------------|---------------|-------------------|
| Admin Global | [ ] SÍ | [ ] SÍ | [ ] SÍ | [ ] SÍ |
| Admin Organizador | [ ] Propio | [ ] Propio | [ ] Propio | [ ] NO |
| Promotor | [ ] SÍ (lectura) | [ ] NO | [ ] NO | [ ] NO |
| Puerta | [ ] NO | [ ] NO | [ ] NO | [ ] NO |
| Cliente Final | [ ] SÍ (lectura) | [ ] NO | [ ] NO | [ ] NO |

**Notas**:  
_________________________________________________________________

---

## PARTE 4: Impacto en Módulos (Tech Lead Lidera)

### Cambios Requeridos por Módulo

#### 1. API /api/layout
```
Cambio: GET /api/layout → necesita event_id en query
[ ] Requerido (debe pasar)
[ ] Opcional (fallback a global)
[ ] Ignorar event_id
```

#### 2. API /api/tables/update
```
Cambio: Validar que tables.event_id = contexto.event_id
[ ] Implementar validación
[ ] No validar (confiar en RLS)
```

#### 3. LayoutEditor.tsx
```
Cambio: Pasar event_id a cargas, filtrar por evento
[ ] Selector de evento en UI
[ ] Obtener evento del contexto (session)
[ ] Ambos
```

#### 4. /admin/tables/create
```
Cambio: Mesa se crea siempre con event_id
[ ] Requerido
[ ] Opcional
```

#### 5. Landing (compra/reservas)
```
Cambio: Filtros por evento ya están, solo optimizar
[ ] Sin cambio requerido
[ ] Pequeños ajustes
```

#### 6. Scan/Puerta
```
Cambio: Agnóstico (no ve layout), solo QR
[ ] Sin cambio
```

---

## PARTE 5: Migración y Rollout (Tech Lead + DevOps)

### Estrategia de Migración

**Fecha de Implementación**: ___________

```
[ ] Phase 1: Preparación (1-2 días)
    Tareas:
    - [ ] Crear tabla/schema nueva
    - [ ] Tests unitarios nuevos
    - [ ] Deploy a staging
    
[ ] Phase 2: Dual-Write (1-2 días)
    Tareas:
    - [ ] Lógica escribe en ambas tablas (old + new)
    - [ ] Lógica lee de tabla nueva (con fallback)
    - [ ] Validar 100% de eventos migrados
    
[ ] Phase 3: Cutover (1 día)
    Tareas:
    - [ ] Cambiar lectura a tabla nueva
    - [ ] Monitorear errores
    - [ ] Rollback plan listo
    
[ ] Phase 4: Cleanup (después de 2 sprints)
    Tareas:
    - [ ] Remover código de fallback
    - [ ] Remover tabla vieja (si aplica)
    - [ ] Actualizar docs
```

### Plan de Rollback
```
Si algo falla en Cutover:
- [ ] Revertir código a versión anterior
- [ ] Datos quedan en ambas tablas (seguro)
- [ ] Tiempo estimado: < 15 min
```

---

## PARTE 6: Testing y Validación (QA Lidera)

### Plan de Pruebas

#### Funcional
- [ ] Crear evento con croquis personalizado
- [ ] Crear mesa en evento A con posición X
- [ ] Crear mesa en evento B con posición Y diferente
- [ ] Validar que mesas no se mezclen entre eventos
- [ ] Editar posición en evento A, validar evento B sin cambios
- [ ] Cliente ve mesas del evento correcto en landing
- [ ] Scan filtra tickets del evento correcto

#### Regresión
- [ ] Eventos antiguos siguen funcionando
- [ ] Reservas siguen siendo válidas
- [ ] Pagos no se afectan
- [ ] Auditoría de cambios funciona

#### Seguridad
- [ ] Usuario de Org A no ve mesas de Org B
- [ ] Promotor no puede editar croquis
- [ ] Admin puede ver todo

#### Performance
- [ ] Cargar LayoutEditor con 10+ mesas: < 2s
- [ ] Cargar landing con mesas: < 1s
- [ ] Scan no ralentiza

---

## PARTE 7: Documentación y Cierre (PM)

### Documentación a Actualizar
- [ ] README.md (feature multi-evento)
- [ ] AGENTS.md (si es cambio de arquitectura)
- [ ] ADR (Architecture Decision Record)
- [ ] Runbooks operativos
- [ ] Tests documentation

### ADR a Crear
```
Título: "Layouts por Evento en lugar de Global"

Contexto:
  - Necesidad de eventos con croquis personalizados
  - Multi-organizador requiere flexibilidad

Decisión:
  - Implementar event_layouts (1 por evento)
  - Deprecar layout_settings global (o mantener fallback)

Consecuencias:
  - Cada evento puede tener su layout
  - Mayor flexibilidad, sin complejidad
```

### Fecha de Cierre
- [ ] Feature completado y en prod: ___________
- [ ] Documentación finalizada: ___________
- [ ] Monitoreo en lugar: ___________

---

## PARTE 8: KPI y Métricas

### Métricas de Éxito
```
[ ] 100% de eventos con layout asignado
[ ] Cero errores de layout en logs
[ ] Tiempo de carga LayoutEditor < 2s (p95)
[ ] Cero incidentes en scan relacionados a layout
[ ] PM confirma casos de uso cubiertos
```

### Monitoreo Post-Deployment
```
[ ] Dashboard de layout errors creado
[ ] Alert configurado para eventos sin layout
[ ] Logs estructurados (event_id + layout_id)
[ ] Semanal: revisar métricas vs baseline
```

---

## PARTE 9: Firmas de Aprobación

| Rol | Nombre | Firma | Fecha |
|-----|--------|-------|-------|
| PM | _____________ | _____ | _____ |
| Arquitecto | _____________ | _____ | _____ |
| Tech Lead | _____________ | _____ | _____ |
| DevOps | _____________ | _____ | _____ |

---

## APÉNDICE: Referencias

- Documento: `MULTI_EVENT_LAYOUT_DESIGN.md` (análisis detallado)
- Referencia: `MESAS_LAYOUT_REFERENCE.md` (cómo funciona hoy)
- Código: `/apps/backoffice/app/admin/tables/layout/LayoutEditor.tsx`
- API: `/apps/backoffice/app/api/layout`, `/api/tables`

