# Plan: Bloques inversos + fallback Seeke↔AV1 + validación dura latest_episode + ranking editable + aviso descargas

## 1. Bloques inversos (Seeke unido → mi página dividida)

Caso: en Seeke un anime tiene 1–48 continuos. En mi página existen como **dos AniList IDs** (Temp 1 = 1–24, Temp 2 = 1–24). Debo poder mapear los caps "visuales" de mi página a un offset en la URL madre Seeke.

### Cambios en DB
Extender `video_cache_blocks` añadiendo dos columnas opcionales:
- `source_episode_offset` (int, default 0) — desplazamiento que se suma al episodio relativo del bloque para construir el episodio que se pide a la VPS.
- `inverse_mode` (boolean, default false) — solo flag visual para el admin (saber que este registro es del modo inverso).

Reutilizamos el mismo registro (`anilist_id`, `lang`, `block_index`) — no se crea tabla nueva. Para el modo "inverso" típicamente habrá **un solo bloque** por AniList ID (ej. `episode_from=1, episode_to=24, source_episode_offset=24, seeke_base_url=<madre Seeke unida>`).

### Cambios en `src/lib/video-blocks.ts`
- Añadir los dos campos a `VideoBlock`, `ResolvedBlock`.
- En `resolveSeekeBaseForEpisode` calcular:
  ```
  episodeWithinBlock = (episode - episode_from + 1) + source_episode_offset
  ```
  Así el episodio "visual" 1 se transforma en 25 cuando el offset es 24.
- En `getLatestEpisodeByLang`, cuando hay offset:
  - Pedir `latest_episode` a la madre.
  - Restar el offset y limitar al rango del bloque.
  - Devolver el `globalEp` resultante (si la madre tiene 30 y offset 24 → bloque ya tiene hasta el 6 visual).
- `saveBlocks`: aceptar y validar los nuevos campos.

### Admin UI (`BlocksEditor.tsx`)
- Toggle "Modo inverso (Seeke unido → mi página dividida)" por idioma.
- Cuando está activo: mostrar un campo extra "Empezar desde el cap N de Seeke" (= `source_episode_offset + 1`). Etiqueta clara: "En Seeke, esta temporada empieza en el cap X".
- Validar: con offset >0, el bloque suele ser único; permitir múltiples si el usuario quiere.

### Reproductor (`AnimePlayer.tsx`/`Watch.tsx`)
- Donde se invoca el embed Seeke, ya pasa por `resolveSeekeBaseForEpisode`. Solo hay que asegurarse de que el `episode` enviado al backend sea `resolved.episodeWithinBlock` (esto ya está, solo cambia el cálculo interno).

## 2. Fallback inteligente Seeke ↔ AnimeAV1 según `latest_episode`

Reglas (usadas SOLO cuando el episodio sí existe globalmente — ver §3):
- Cargar Seeke si:
  - hay madre/bloques para ese `(anilist_id, lang, episode)` **y** `episode <= latest_episode_seeke_para_ese_idioma`.
- Si Seeke se quedó corto (`episode > latest_seeke` pero `episode <= anilist.episodes` o `<= latest_av1`), usar AnimeAV1 con slug.
- Si AnimeAV1 se queda corto y Seeke tiene más, usar Seeke.
- Si ninguno cubre el episodio → bloquear (regla §3).

### Implementación
- Nueva función `pickProvider(anilistId, lang, episode, slug)` en `src/lib/video-blocks.ts` o nuevo `src/lib/provider-router.ts`:
  1. `latestSeeke = await getLatestEpisodeByLang(anilistId, lang, fallbackBase)`
  2. `latestAV1 = await getAV1LatestForSlug(slug)` (nueva helper en `zetapi.ts` que ya pega a la VPS/AV1)
  3. Devuelve `{ provider: 'seeke' | 'av1' | null, reason }`.
- `AnimePlayer.tsx`: antes de montar el player, llamar `pickProvider`. Si `null`, no construir nada (ver §3). Si cambia de provider entre episodios, **destruir el player anterior** (HLS, listeners, subs) y reconstruir.

## 3. Validación dura `latest_episode` — bloqueo total de episodios fantasma

Eliminar todo fallback automático cuando `requestedEpisode > max(latestSeeke, latestAV1)`.

### En `AnimePlayer.tsx`
- Añadir guard al inicio del effect que carga el episodio:
  ```
  const maxAvailable = Math.max(latestSeeke ?? 0, latestAV1 ?? 0);
  if (requestedEpisode > maxAvailable) {
    hardCleanup();          // pause, src="", load(), destroy HLS, destroy subs
    setBlockedReason("Episodio aún no disponible");
    return;
  }
  ```
- `hardCleanup` debe limpiar: `video.pause()`, `removeAttribute("src")`, `video.load()`, destruir HLS, destruir motor de subs, resetear `currentEmbed`, `lastServer`, `lastEpisode`, `lastHls`, `lastSubtitleTrack` (variables de cache en memoria del componente y del módulo).
- En `seekeMemoryCache` y `clearSeekeEpisodeCache`: añadir helper `purgeForEpisode(anilistId, lang, episode)` y llamarlo cuando se bloquea.
- Mostrar overlay claro: ícono lock + "Episodio aún no disponible".

### En `Watch.tsx` / `BentoEpisodes.tsx`
- Calcular `maxAvailable` por idioma una vez.
- Botones con `episode > maxAvailable` → `disabled`, opacidad 50%, ícono lock, tooltip "No disponible".
- "Siguiente episodio" desactivado si superaría `maxAvailable`.
- Cambio de idioma: si `currentEpisode > maxForNewLang`, mostrar el overlay de bloqueo y NO autoplay.

### Cero reciclaje
- Cada cambio de episodio: `DESTROY → CLEAN → VALIDATE → REBUILD`. Cambiar el flujo a:
  1. `hardCleanup()`
  2. `pickProvider()` → si null, mostrar bloqueo y salir
  3. resolver embed/HLS
  4. crear nuevo HLS + subs

## 4. Aviso "Anime ya completado" en VideoManager (búsqueda admin)

En `src/components/admin/VideoManager.tsx`:
- Cuando el admin busca/selecciona un anime, query a `anime_download_tracker` por `anilist_id` y `status='completed'`.
- Si hay match: mostrar banner amarillo en la tarjeta de selección: "⚠️ Este anime ya está marcado como COMPLETADO en Descargas."
- No bloquea, solo informa.

## 5. Editor de Ranking + auto-actualización

Nueva sección en Admin "Ranking destacado":
- Tabla `ranking_overrides` con columnas: `id`, `anilist_id`, `position` (int 1–N), `anime_title`, `cover_image`, `enabled` (bool), `auto_update` (bool global vía `app_settings`), `created_by`, timestamps. RLS admin/owner write, public read.
- UI permite:
  - Listar posiciones 1..N.
  - Reemplazar el anime de cada posición buscando por título (AniList).
  - Toggle global "Auto-actualizar ranking" (guardado en `app_settings.key='ranking_auto_update'`).
- Cuando `auto_update = true`: el componente público (`TopRanking.tsx`) ignora overrides y consume el ranking dinámico actual (AniList trending o `anime_views`).
- Cuando `false`: respeta `ranking_overrides` ordenado por `position`.
- `TopRanking.tsx`: lee primero `app_settings`, luego decide fuente.

---

## Archivos a tocar

**Migraciones SQL**
- Añadir `source_episode_offset int default 0`, `inverse_mode boolean default false` a `video_cache_blocks`.
- Crear `ranking_overrides` con RLS.
- Insertar fila default en `app_settings` (`ranking_auto_update` = `'true'`).

**Frontend**
- `src/lib/video-blocks.ts` — offset inverso, `pickProvider` (o nuevo `provider-router.ts`).
- `src/lib/zetapi.ts` — helper `getAV1LatestForSlug`, exportar `clearSeekeEpisodeCache` granular.
- `src/components/admin/BlocksEditor.tsx` — toggle inverso + campo offset.
- `src/components/admin/VideoManager.tsx` — aviso "ya completado".
- `src/components/video/AnimePlayer.tsx` — `hardCleanup`, guard `requestedEpisode > maxAvailable`, switch dinámico de provider, overlay de bloqueo.
- `src/pages/Watch.tsx` — propagar `maxAvailable`, deshabilitar next.
- `src/components/anime/BentoEpisodes.tsx` — botones bloqueados.
- `src/components/anime/TopRanking.tsx` — leer overrides + flag.
- `src/components/admin/RankingManager.tsx` (nuevo) + tab en `Admin.tsx`.

## NO se toca
- Player HLS internals, sistema de embeds, subtítulos, renderizado del video.
- Acceso restringido a APK/notificaciones/pago — siguen siendo solo del owner.
