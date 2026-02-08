# RBAC MATRIX 2026-02 (INICIAL)

## Objetivo
Definir permisos minimos por rol para evitar ambiguedad funcional y facilitar implementacion backend-first.

## Modulos
- Eventos
- Codigos y promotores
- Tickets y escaneo
- Mesas, combos y ventas onsite
- Usuarios y seguridad
- Reportes
- Configuracion de branding/layout

## Acciones estandar
- `read`: ver/listar
- `create`: crear
- `update`: editar
- `delete`: archivar/anular (nunca borrado fisico)
- `approve`: autorizar accion sensible
- `export`: exportar reportes

## Matriz base
| Rol | Eventos | Codigos/Promotores | Tickets/Scan | Mesas/Combos/Ventas | Usuarios/Seguridad | Reportes | Branding/Layout |
|---|---|---|---|---|---|---|---|
| admin | read/create/update/delete | read/create/update/delete | read/create/update/delete/approve | read/create/update/delete/approve | read/create/update/delete/approve | read/export | read/create/update/delete |
| puerta | read | read | read/update (solo scan/confirm) | no | no | read (operativo minimo) | no |
| promotor | read (publico) | read (propios codigos/estado) | no | no | no | read (propio rendimiento) | no |
| moso | read (evento activo) | no | no | read/create/update (ventas permitidas) | no | read (operativo) | no |
| cajero | read | no | read | read/create/update (cobro) | no | read/export (ventas caja) | no |
| cliente_final | read (publico) | no | read (ticket propio) | read (catalogo publico si aplica) | no | no | no |

## Reglas sensibles (obligatorias)
- `cajero.delete` (anular): requiere `approve` de admin/superior con codigo de autorizacion
- `puerta`: sin acceso a datos administrativos no necesarios
- `promotor`: sin acceso al panel administrativo interno
- `admin`: toda accion sensible debe quedar auditada

## Recomendacion tecnica de implementacion
- Tabla de permisos por accion (`role_permissions`)
- Middleware central de autorizacion por endpoint
- Auditoria por accion critica:
  - actor_id
  - actor_role
  - action
  - resource_type/resource_id
  - correlation_id
  - created_at
