# Portadas y descripción editable

La portada principal del home utiliza la foto original proporcionada por el usuario, en `public/images/baby-home-cover.jpg`. No se modifica ni regenera la fotografía.

En el backoffice: Eventos → editar → “Portada y miniatura del evento” y “Descripción pública del evento”. La imagen de cabecera existente, guardada en `event_messages` con clave `cover_image`, se usa tanto en la tarjeta del home como en el detalle. El manifiesto `events.header_image` conserva su función anterior y no se usa como flyer. La descripción se guarda como texto con clave `public_description`, máximo 2000 caracteres, sin HTML; vacía oculta el bloque. Los clientes antiguos que no envían el campo de descripción no lo borran.

Se retiran “La experiencia BABY” y la frase fija. No hay migraciones ni modificaciones manuales de registros productivos. Las APIs mantienen la autorización de personal existente.

Validado: actualización autenticada en Supabase local, persistencia y lectura de imagen/texto, eliminación de descripción al vaciar el campo; 510 pruebas en 115 archivos y compilaciones de ambas apps. Las claves y datos de pruebas no forman parte del release.
