## 📋 Plan de Implementación Definitivo (Sin Cifrado)

### 1. Rebranding Visual: "Apoyo y Donación"

- **Objetivo:** Cambiar el enfoque comercial por uno de comunidad (voluntario), lo cual mejora la retención y la situación legal del proyecto.
- **Cambios en** `PremiumScreen.tsx`**:**
  - Título: "Apoya a ZetAnime" en lugar de "ZetAnime Premium".
  - Subtítulo: "Tu aporte mantiene la página viva y sin restricciones para ti".
  - Botón principal: "Hacer mi aporte" (mantiene la integración con Ko-fi).
  - Texto de cierre: "Recibe beneficios como agradecimiento por tu apoyo".
- **Cambios en** `ExpiryAlert.tsx`**:** "Tu apoyo expira en X días. Renueva para seguir disfrutando los beneficios."
- **Cambios globales:** Reemplazar la palabra "Premium" por "Apoyador" en medallas y menús del usuario, manteniendo los niveles internos (Básico, Solo, Dúo) intactos en el sistema.

### 2. Verificación del Sistema de Planes (Admin y Fechas)

- **Objetivo:** Asegurar que cuando tú (el admin) actives un plan manualmente, el sistema responda de forma automática.
- **Validación en Base de Datos:** Comprobar que los campos `subscription_status = 'active'`, `plan_type` y `subscription_expires_at` se actualicen correctamente en la tabla `profiles`.
- **Lógica de Control:** Verificar que la aplicación del plan funcione en tiempo real y que el acceso se restrinja de inmediato una vez que pasen los días asignados por el administrador.

### 3. Notificaciones de Reportes Solucionados

- **Objetivo:** Avisar a los usuarios cuando arregles un enlace, haciendo que regresen a la web.
- **Flujo en** `BrokenReports.tsx`**:** Al presionar "Solucionado", se abrirá un modal con un cuadro de texto opcional.
- **Automatización:** El sistema creará una fila en la tabla `notifications` por cada usuario que reportó ese error específico (`target_user_id`).
- **Mensaje por defecto (Editable):** *"¡Buenas noticias! El episodio {n} de {anime} que reportaste ya fue solucionado. Pruébalo de nuevo."*
- **Historial de Admin:** Te generará una notificación interna de confirmación: *"Notificaste a X usuarios del reporte de {anime} EP{n}"*.

### 4. Optimización Masiva y Compresión de la BD (¡Crítico!)

- **Objetivo:** Liberar espacio urgente en Supabase acortando los datos y borrando basura.
- **Limpieza por Cron Diario (Función SQL):**
  - `streaming_sessions` con más de 7 días de antigüedad $\rightarrow$ **ELIMINAR**.
  - `device_sessions` revocadas hace más de 30 días $\rightarrow$ **ELIMINAR**.
  - `notification_dismissals` huérfanas (sin notificación asociada) $\rightarrow$ **ELIMINAR**.
  - `admin_activity_log` con más de 90 días $\rightarrow$ **ELIMINAR**.
  - `slug_cache` sin usarse en más de 60 días (añadiendo campo `last_used_at`) $\rightarrow$ **ELIMINAR**.
- **Compresión JSON en tablas de enlaces:** Reescritura de los datos en `video_cache.sources` y `latino_episodes.sources`. Pasaremos de guardar nombres largos a iniciales cortas para ahorrar más del 50% de espacio por fila:
  - `{hls: [], mp4: [], embed: []}` $\rightarrow$ Se transforma en: `{h: [], m: [], e: []}`.

> ⚠️ **REGLA DE SEGURIDAD ABSOLUTA PARA LOVABLE:** Al aplicar la compresión JSON, se deben actualizar de inmediato los archivos `video-cache.ts` y `Watch.tsx` para que lean las nuevas llaves `{h, m, e}`. El reproductor de video no puede quedarse buscando las llaves antiguas o se romperá la visualización.

### 5. Alerta de Expiración (5 días antes)

- **Objetivo:** Automatizar el aviso de renovación para los apoyadores.
- **Edge Function (**`premium-expiry-notifier`**):** Un script que corre una vez al día buscando usuarios cuyo `subscription_expires_at` venza en exactamente 4 o 5 días.
- **Evitar Spam:** Se añade el campo `expiry_notice_sent_at` en la tabla `profiles` para registrar que ya se les notificó y no enviar el mensaje dos veces.
- **En el centro de notificaciones:** Si el usuario recibe este aviso, se renderizará un botón especial de acción al lado del texto que diga: *"Apoyar a ZetAnime"* con enlace directo a tu Ko-fi.

## 📋 Mensaje listo para copiar y pegar en Lovable

Le puedes poner esto directamente para que empiece a trabajar bajo tus condiciones estrictas:

Plaintext

```
Este es el plan de trabajo definitivo. Vamos a ejecutarlo en orden, bloque por bloque, probando cada uno antes de pasar al siguiente. Nota importante: Se descarta por completo el Bloque 5 (Cifrado CK), no quiero encriptación en los enlaces ni cambios en el flujo de reproducción del player. Mantén el reproductor exactamente como está funcionando ahora.

Por favor, procede en este orden:

1. Bloque 1: Rebranding Visual (Cambiar textos de Premium a "Apoyo/Apoyador" en frontend).
2. Bloque 2: Verificación de aplicación y cancelación automática de planes según los días del admin.
3. Bloque 3: Sistema de notificaciones al solucionar reportes en BrokenReports.tsx.
4. Bloque 4: Optimización de BD (Limpieza de sesiones viejas) y Compresión JSON de las llaves a {h, m, e}. Cuidado extremo aquí: asegúrate de actualizar video-cache.ts y Watch.tsx para que el reproductor lea correctamente las nuevas llaves abreviadas y no deje de funcionar.
5. Bloque 5: Edge function con cron diario para la alerta de expiración de 5 días antes.

Confírmame que entiendes las instrucciones y el orden, y muéstrame los avances del paso 1.
```