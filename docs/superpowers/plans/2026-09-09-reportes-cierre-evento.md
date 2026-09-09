# Cierre de evento y UX de reportes

Estado: implementado y validado localmente; publicación pendiente. Solicitud aprobada por Rapha el 2026-09-09.

## Objetivo

Una vista por evento que explique asistencia, compras, cortesías, mesas y calidad del registro comercial, con exportación de las mismas cifras. Referencia de conciliación: THE BABY GALA, 108 ingresos confirmados, 25 accesos asociados a compras, 2 invitados de mesa, 39 cortesías y 42 generales sin clasificación histórica. 31 reservas de entradas aprobadas con S/755 declarados y 2 reservas de mesa; estos importes no prueban caja ni utilidad.

## Arquitectura y alcance

Next.js + Supabase existentes, sobre master 91b50a4, rama codex/reportes-cierre-evento-20260909. Se aplican guías de Sites para UX, estados y validación; destino de publicación Vercel existente. No se inicializa Sites ni se migra alojamiento.

- Modelo puro en lib/reports: clasificación por evidencia, archivo al cierre, deduplicación y exportación.
- Lector Supabase paginado por evento y API exclusiva de consulta con permisos admin/superadmin, errores explícitos y respuesta privada sin caché.
- Nueva superficie de cierre en /admin/reportes/mesas, enlazada desde el hub. Selector por evento, resumen, asistencia, ingresos/mesas, promotores y calidad. Carga automática, cancelación de respuestas antiguas y exportación del resultado visible.
- Las reservas borradas exactamente al cierre se recuperan para lectura histórica; otros borrados no se convierten en ventas. No se modifica ningún dato histórico.
- Un QR general no acredita gratuidad ni cobro en puerta. Una reserva aprobada acredita un pedido aprobado; sus importes y pagos confirmados se muestran por separado, sin sumarlos. Sin registro de consumo y gastos no se calcula utilidad.
- Correcciones acotadas de compatibilidad en el reporte anterior: horas de escaneo, tarjetas de asistencia y personas marcadas siempre como ausentes.

## Secuencia de ejecución y validación

1. Aislar checkout e instalar lockfile; correr baseline de reportes, QR y dashboard.
2. Escribir regresiones fallidas para archivos al cierre, QR de compra emitido como cortesía, precheck/duplicados, generales desconocidos, importes ausentes, pagos duplicados por joins y paginación. Implementar modelo y lector.
3. Construir superficie funcional con componentes/tokens existentes. Vista previa local de solo lectura con datos agregados y sin credenciales de producción.
4. Conectar la API autenticada; probar permisos, validación, errores, evento vacío y exportación.
5. Conciliar endpoint local contra Supabase exclusivamente con GET, sin escrituras ni información personal en resultados. Comparar todos los eventos con la auditoría.
6. Validar tipos, pruebas pertinentes, build y navegador autorizado (desktop, móvil, cambio de evento, carga/error/vacío y exportación).
7. Documentar resultado y límites; conservar rama revisable. Publicación en Vercel pendiente de autorización explícita.

## Fuera de este primer cierre

Caja de puerta, consumo/POS de mesas, gastos, devoluciones parciales y enlace permanente de promotores requieren sus siguientes slices funcionales. Su ausencia se muestra como información pendiente, nunca como importe cero ni ganancia calculada. El mapeo previo del enlace permanente sigue vigente.

## Resultado

Ver `docs/audits/2026-09-09/UX-CIERRE-VALIDACION.md`: 30 pruebas, tipos y build pasan, nueve eventos conciliados y CSV descargado validado contra el corte visible.
