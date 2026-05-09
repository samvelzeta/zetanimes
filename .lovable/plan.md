# Plan: Owner-only tabs, motor de subtítulos profesional, rebuild de player y wipe de cache

Voy a abordar 4 frentes en una sola entrega.

---

## 1. Restricciones de acceso en panel admin (Owner-only)

En `src/pages/Admin.tsx` ya existe el rol `owner` ([samvelzeta@gmail.com](mailto:samvelzeta@gmail.com)). Voy a:

- Ocultar completamente las pestañas y secciones siguientes para cualquier admin que NO sea owner:
  - **APK Manager** (subir/editar APK)
  - **Notificaciones globales** (envío de avisos a usuarios)
  - **Premium / Pagos** (aprobaciones de premium, comprobantes, configuración de contacto)
  - **Activity Log** (ya es owner-only, se confirma)
  - **Roles** (asignar admin/premium) — solo owner
- Los demás admins seguirán viendo: Descargas, Videos, Slugs, Episodios, Reportes rotos, Animes ocultos.
- Doble capa de seguridad: además de ocultar UI, validar `isOwner` antes de cualquier mutación crítica (insertar APK, enviar notif, aprobar premium).

---

## 2. Motor de subtítulos profesional (sin `<track>`)

Crear `src/lib/subtitle-engine.ts`: una clase `SubtitleEngine` aislada por instancia de player.

**Características:**

- Parser SRT/VTT propio (sin libs externas pesadas) → array de cues `{start, end, text}`.
- Descarga del .srt vía cascada de proxies (ya existente) + nuevo edge function `subtitle-proxy` como ruta principal (VPS-style: backend descarga, frontend solo pinta).
- Render loop con `requestAnimationFrame` + fallback `setInterval(250ms)` cuando la pestaña está en background.
- Búsqueda binaria de cue activo según `video.currentTime`.
- Overlay HTML controlado (no `<track>`), con z-index alto, text-shadow fuerte, responsive.
- Listeners: `seeking`, `seeked`, `play`, `pause`, `waiting`, `loadedmetadata`, `visibilitychange`, `fullscreenchange` → reanudan/forzan repaint.
- Método `destroy()`: cancela RAF, limpia interval, remueve listeners, vacía cues, limpia overlay.
- Método `setLanguage(sub)`: destruye estado previo, descarga nuevo .srt, re-parsea, reinicia loop.
- aplicar todo eso en caso de que no exista o mejorar lo que ya esta con las instrucciones de ejempolo que se te leyo enviado del onwer, no modificar los subtitulos(en el sentido del color de las letras y el fondo de sombra oscura de las letrasque se muestran en pantalla)

**Edge function nuevo `subtitle-proxy`:** descarga el .srt server-side con headers correctos (User-Agent + Referer), devuelve `{ok, content}`. Evita CORS y headers bloqueados.

**Integración en `AnimePlayer.tsx`:** reemplazar el sistema actual de fetch+cues+rAF por `useSubtitleEngine(videoRef, subtitle)` hook. Garantiza una instancia por player (multiusuario seguro).

---

## 3. Anti-stream pegado: validación + rebuild total

**Cache inteligente con fingerprint** (`src/lib/video-cache.ts` y `zetapi.ts`):

- Clave compuesta: `animeId + episode + lang` (ya existe parcialmente, lo refuerzo).
- Antes de servir cache, validar: si `cached.embed === lastPlayedEmbed` pero `requestedEpisode !== lastEpisode` → invalidar esa entrada y refetch.
- Añadir `fingerprint` SHA-1 corto del embed al guardar; comparar al recuperar.
- Cache busting: `?t=${Date.now()}` solo cuando se detecta conflicto, no siempre (preserva CDN).
- solucionar problema de demaciados botones jntos en el player en modo apk, botones de pasar cap y devolver cap se ejecutan aun estndo ocultos, no deberia de suceder solo funciona cuando aparecen des pues del tap o click de confirmacion

**Rebuild del player en cambio de episodio/idioma/anime/servidor** (`AnimePlayer.tsx`):

- `AbortController` para cancelar fetches anteriores.
- `hls.destroy()` + `hls = null` antes de crear nueva instancia.
- Limpieza del `<video>`: `pause() → removeAttribute("src") → load() → innerHTML=""`.
- `subtitleEngine.destroy()` siempre antes de re-crear.
- Reset de estado React: `currentEmbed`, `currentEpisode`, `subtitleState`, `currentTrack`.
- Nueva instancia HLS con `backBufferLength: 0` para no compartir buffers.
- Hook `useEffect` con dependencias `[episode, lang, anime, server]` que ejecuta DESTROY → CLEAN → REBUILD.

---

## 4. Wipe total del cache de servers

Migración SQL para vaciar:

- `video_cache` (todos los servers manuales y Seeke cacheados)
- `slug_cache` (opcional, lo dejo intacto salvo confirmación)
- `latino_episodes` NO se toca (son uploads HLS reales del owner)

Adicional: limpiar localStorage `zet:seeke:*` en cliente (auto al próximo load via bump de `SEEKE_CACHE_VERSION` a `v4`).

---

## Archivos afectados

**Nuevos:**

- `src/lib/subtitle-engine.ts` — motor SRT/VTT con render loop
- `src/hooks/useSubtitleEngine.ts` — hook React por instancia
- `supabase/functions/subtitle-proxy/index.ts` — proxy VPS-style
- Migración SQL: `TRUNCATE video_cache`

**Editados:**

- `src/pages/Admin.tsx` — gating owner-only de tabs sensibles
- `src/components/video/AnimePlayer.tsx` — integración engine + rebuild total
- `src/lib/video-cache.ts` — fingerprint + validación anti-stream-pegado
- `src/lib/zetapi.ts` — bump versión seeke cache a v4

---

## Confirmación

¿Procedo con todo el plan? Si quieres ajustar (p. ej. mantener Roles para admins, o no truncar `slug_cache`), dímelo antes.