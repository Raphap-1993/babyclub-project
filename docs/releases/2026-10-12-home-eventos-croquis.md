# Home, eventos y croquis — 2026-10-12

Base de producción verificada: e67a6b3ba430e589c3c0c5ef2dd5c5d27f3112d2, master de Raphap-1993/babyclub-project. GitHub registra despliegues exitosos de landing y backoffice para esa revisión.

Publica el home minimalista, detalle con entradas y cantidades, croquis administrado dinámicamente y selección de espacio/paquete. La transición al checkout preserva los precios verificados, snapshots y guardas de cambios del código de producción, además de los enlaces de promotores y nominación. /codigo conserva el ingreso existente y /?mode=nomination o mode=access sigue funcionando. El footer incluye acceso a entradas/códigos y páginas legales.

No cambia tablas ni migraciones, credenciales, proveedores de pago, configuración de Vercel, registros de clientes o reservas. Mercado Pago no forma parte de este release. No contiene el seed, los scripts de instalación ni las credenciales de Supabase local.

Validación: 510 pruebas en 115 archivos, compilaciones de landing/backoffice, QA del artefacto compilado contra Supabase local a 1440/390/430/320px, selección y totales de entradas, elección SVG de los diez espacios, continuidad al formulario y bloqueo de ventas agotadas/espacios reservados. No se enviaron compras, correos ni cobros productivos durante la validación.

Publicación: push fast-forward a master, despliegue automático de Vercel. Comprobar ambos deployments de GitHub y smoke público de home, detalle, APIs de catálogo/croquis, código y páginas legales sin escribir datos. Si aparecen regresiones, revertir únicamente este commit con git revert y publicar el revert; no hacer force-push ni modificar Supabase.

Memoria consultada: 20_Projects/babyclub-monorepo/00 Context.md, 01 Status.md, 02 Decisions.md, contrastada con la revisión y deployments de GitHub.
