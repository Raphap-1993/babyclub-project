# Release: cierre por evento y descarga Excel

## Alcance autorizado

El 10 de septiembre de 2026 el usuario autorizó integrar los reportes, agregar descarga Excel y publicar en producción conservando GitHub, Vercel, Supabase y los dominios actuales. Esta entrega continúa el slice documentado en `../2026-09-09/UX-CIERRE-VALIDACION.md`; sus referencias a publicación pendiente y Next sin actualizar describen el estado anterior.

- Cierre consolidado en `https://babyclub-backoffice.vercel.app/admin/reportes/mesas`.
- Sitio público existente: `https://babyclubaccess.com/`.
- Excel OOXML real `.xlsx`, generado en el navegador desde el mismo corte visible, con hojas Cierre y Promotores, importes numéricos en soles, filtros y encabezados congelados. CSV conservado.
- Los valores no disponibles no se transforman en cero. Reservas y pagos no se suman. Los nombres se escriben como texto, nunca como fórmulas.
- Next.js actualizado de 16.0.7 a 16.3.4 en ambos sitios. Parches transitivos compatibles para minimatch, brace-expansion y ws.
- Prueba de aprobación administrativa actualizada al flujo vigente: emisión del QR del comprador y correo con ticket/código. El fallo se reprodujo idéntico en producción base `91b50a4`; no requirió cambiar la lógica productiva de reservas.

No hay migraciones ni escritura de datos operativos. Caja en puerta, registro de consumos, gastos, ganancia neta y enlace permanente de promotores siguen como próximos slices funcionales. El cierre muestra sus límites de información explícitamente.

## Verificación previa a publicación

- Suite completa: 96 archivos, 337 pruebas aprobadas.
- TypeScript: backoffice y landing sin errores.
- Builds de producción: backoffice y landing terminados con Next.js 16.3.4; backoffice reconstruido tras el último ajuste de texto.
- Excel: tres pruebas de estructura, tipos numéricos/fecha, valores ausentes y textos similares a fórmulas. Archivo descargado realmente desde Chrome y leído nuevamente como XLSX: dos hojas, 108 ingresos, S/755 declarados, total de promotores 108, cero fórmulas.
- Revisión visual del archivo: cabecera, columnas, notas, importes, datos faltantes y tabla de promotores legibles.
- Revisión independiente de Echo aprobada sin hallazgos accionables críticos, altos o medios. Validó adicionalmente el XML del XLSX con un lector independiente: decimales correctos y nombres como texto, sin fórmulas ni hipervínculos.
- Auditoría de dependencias productivas: 0 críticas, 0 altas; persisten 2 rutas de severidad moderada de uuid transitivo. El aviso corresponde a v3/v5/v6 con buffer proporcionado por el llamador; este exportador no invoca esas funciones. No se fuerza un cambio mayor transitivo incompatible.
- El checkout principal con cambios previos del usuario no se modifica. La integración parte del worktree limpio de master y usa avance rápido, sin force push.

Referencia del parche de framework: [Next.js August 2026 security release](https://nextjs.org/blog/august-2026-security-release). Formato de exportación: [ExcelJS](https://github.com/exceljs/exceljs).

## Publicación y comprobación

Integrar la rama `codex/reportes-cierre-evento-20260909` en master y publicar mediante el autodeploy existente. Exigir estado terminal exitoso de ambos proyectos Vercel para el commit publicado. Luego comprobar el cierre autenticado y descargar su Excel en producción, además del sitio público y el bloqueo de la ruta de vista previa. Registrar commit, identificadores de despliegue y resultados en la trazabilidad operativa de BabyClub en Obsidian.

Ante una regresión, revertir en orden inverso los commits de esta entrega mediante un nuevo commit en master y esperar ambos despliegues. Base previa: `91b50a4f1039de425deece7e2feb58d56cbe87e1`. No hay datos ni esquema que restaurar. Revertir la actualización de Next restablecería vulnerabilidades conocidas; preferir corregir hacia delante o conservar sus parches al retirar solo el cierre.
