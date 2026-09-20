# Reparar autenticación y correos de ZetAnime

## Resultado
- Registro, inicio de sesión y recuperación seguirán usando el backend actual aunque el sitio esté servido desde Cloudflare.
- Los enlaces de confirmación y cambio de contraseña abrirán `https://zetanimes.top`, no la página despublicada de Lovable.
- Un correo ya registrado mostrará una respuesta útil sin crear otra cuenta.
- La pantalla de verificación solo mostrará éxito después de validar realmente el enlace.

## Cambios
1. Unificar los destinos de correo con la dirección pública de ZetAnime para registro y recuperación.
2. Corregir el registro para distinguir cuenta nueva, cuenta pendiente de confirmar y correo ya utilizado; no enviar al inicio como si ya hubiera sesión.
3. Reforzar la pantalla de confirmación para procesar enlaces modernos y anteriores, mostrar enlaces inválidos o vencidos y cerrar la sesión temporal solo después de verificar.
4. Mantener pública la pantalla de cambio de contraseña y comprobar que acepta el enlace de recuperación antes de guardar la clave.
5. Configurar el envío de correos de autenticación con el dominio de ZetAnime. Actualmente no existe un dominio remitente configurado, por lo que será necesario completar la tarjeta de configuración de correo y sus registros DNS en Cloudflare.
6. Probar registro, correo duplicado, acceso y recuperación desde el dominio público.

## Detalles técnicos
- Se conservarán las tablas de perfiles y las reglas de seguridad existentes.
- No se moverá el backend ni se expondrán claves en Cloudflare.
- Los mensajes de recuperación seguirán sin revelar públicamente si una dirección concreta tiene cuenta, mientras el formulario de registro podrá guiar al usuario hacia acceso o recuperación cuando el proveedor lo indique de forma segura.
