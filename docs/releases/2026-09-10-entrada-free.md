# Consolidación de Entrada free

Los accesos con código general y free se presentan como un único tipo, **Entrada free**, en el resumen, asistencia, promotores, CSV y Excel. Las compras aprobadas, pagos confirmados y reservas de mesa conservan prioridad sobre el tipo del código que emitió la entrada.

El desglose omite categorías vacías. Los accesos históricos sin tipo se conservan cuando existen; la tabla de promotores y su hoja Excel muestran esa columna sólo cuando tiene actividad. Los colores del gráfico permanecen asociados a cada tipo aunque cambien las categorías visibles.

La agrupación describe el tipo de entrada. No acredita gratuidad financiera ni modifica cobros históricos. El modelo conserva por separado el conteo de accesos generales sin pago vinculado para su conciliación. No hay migraciones ni escrituras de datos operativos.

Validación: 40 pruebas de reportes, TypeScript y build de backoffice. Los casos sintéticos cubren general/free, prioridad de compra y mesa, relaciones incompletas, confirmaciones repetidas, emisión por promotor, exportación XLSX real y conservación de importes.

Se publica mediante el autodeploy existente de master. Para revertir el cambio, revertir este commit; no requiere restaurar datos ni esquema.
