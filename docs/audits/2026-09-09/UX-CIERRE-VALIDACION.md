# Cierre por evento: implementación y validación

2026-09-09, Lima. Rama local `codex/reportes-cierre-evento-20260909`, base productiva `91b50a4`. Publicación pendiente; no se modificó Vercel, Supabase ni el dominio. Los cambios anteriores de la carpeta principal se preservaron.

## Resultado revisable

`/admin/reportes/mesas` presenta selector de evento con carga automática, indicadores, desglose, resumen comercial y secciones de asistencia, ingresos, mesas, promotores y calidad. El acceso anterior de ingresos abre directamente su sección. Se conservan reportes especializados y navegación existente.

La API `/api/admin/reports/event-close` usa permisos admin/superadmin, paginación completa por evento y respuestas privadas sin caché. No expone datos personales de asistentes, comprobantes ni secretos de QR. Fallar una fuente produce error explícito, nunca un cierre parcial disfrazado de cero.

- Confirmaciones únicas, sin preconsultas ni duplicados. Los QR generales quedan por clasificar.
- Reservas borradas exactamente al cierre incluidas solo para lectura; otros borrados excluidos de ventas.
- Compra identificada antes del tipo de QR; admite mesas históricas sin `sale_origin`.
- Invitaciones anuladas sin ingreso excluidas de ausencias; una anulación posterior no borra una admisión. Las cortesías con código sin ticket se muestran como adicionales al panel de tickets invitados.
- Reservas aprobadas y pagos se muestran separados, con importes desconocidos y monedas no conciliadas explícitos. No se suman fuentes solapadas ni se calcula utilidad.
- CSV obtenido del mismo objeto visible, con protección de fórmulas, sin reconsulta que cambie los filtros o cifras.
- Compatibilidad del reporte anterior: horas de escaneo seleccionadas, claves de las tarjetas corregidas y asistencia histórica deja de estar fija en NO.

## Evidencia

- Baseline: 13 pruebas preexistentes pasaban antes de editar.
- Final: 30 pruebas pertinentes pasan (6 archivos); TypeScript de backoffice sin errores; build de backoffice terminado, 86 páginas generadas.
- Las regresiones de timestamp y asistencia parcial fallaron antes del arreglo y pasaron después. Los escenarios de mesa histórica/invitación anulada fallaron antes del ajuste y pasaron después.
- Lector nuevo contra Supabase real, con barrera GET/HEAD y origen único: nueve eventos, **1.083 ingresos**, frente a los 318 que mostraba el consolidado anterior. Ver `cierre-conciliado.json`.
- THE BABY GALA: **108 = 25 compra + 2 mesa + 39 cortesías + 42 generales pendientes**. 31 reservas aprobadas de entradas con **S/755 declarados**, 2 reservas de mesa y 0 pagos en la tabla de pagos. 37 reservas de todos los estados recuperadas del cierre (33 aprobadas).
- Revisión independiente de Echo: dos hallazgos históricos corregidos; revisión posterior sin hallazgos sustantivos pendientes.
- Navegador: resumen, asistencia, promotores, cambio a evento futuro, estado sin asistentes y disposición móvil comprobados. El selector y las cifras cambian juntos; THE BABY GALA no queda bajo el nombre del evento futuro.
- Descarga real en Chrome: `cierre-THE-BABY-GALA-2026-09-09.csv` verificada byte por byte contra el cierre visible. El listener automático de descargas agotó tiempo tanto en el navegador integrado como en Chrome; la presencia y contenido del archivo descargado confirman el resultado en Chrome.
- Runtime de build con configuración ficticia, sin producción: `/reportes-preview` responde 404 incluso configurando el archivo; API sin sesión responde 401 y `private, no-store`.

## Vista previa local

El archivo `cierre-preview.json` contiene únicamente agregados y promotores anonimizados. La ruta de revisión solo funciona con `NODE_ENV=development` y un archivo expresamente configurado. La vista previa no tiene credenciales ni realiza operaciones en producción. No es el endpoint autenticado desplegado.

Desde la raíz de esta rama:

```sh
REPORTS_PREVIEW_FILE="$PWD/docs/audits/2026-09-09/cierre-preview.json" pnpm --filter backoffice exec next dev --hostname 127.0.0.1 --port 3016
```

Abrir `http://127.0.0.1:3016/reportes-preview`. Captura de datos 09 de septiembre, ~11:27 Lima; Actualizar conserva esa captura. La pantalla productiva consulta el endpoint autenticado al cargar y actualizar.

## Límites y siguiente publicación

Este slice implementa lectura consolidada y UX. No implementa caja de puerta, registro de consumos, gastos, devoluciones parciales ni enlace permanente de promotores. Permanecen en el plan funcional original. El historial general incompleto no permite inventar si una persona pagó o entró gratis. Los QR únicos no garantizan personas físicas únicas.

No hay migraciones ni cambios de esquema. Archivo al cierre es una regla de compatibilidad histórica; la lectura de eventos en curso no es una transacción de snapshot. Los reportes especializados anteriores conservan los límites descritos en la auditoría salvo las correcciones explícitas de arriba; el nuevo cierre es la superficie consolidada revisada.

La publicación se realizará por GitHub/Vercel existentes, previa autorización y revisión de las dependencias vulnerables detectadas en la auditoría general. No se ha actualizado Next.js dentro de este cambio de reportes. No se ha probado aún el nuevo endpoint con una sesión real en producción porque no fue publicado. Para retirar este cambio bastaría revertir su commit; no hay datos que revertir.
