
# Plan: Animes en bloques + latest_episode dinámico

## Parte 1 — Animes en bloques (Black Clover y similares)

### Problema
Algunos animes (Black Clover, etc.) en mi página tienen numeración continua (1–170), pero en las páginas clones de Seeke están divididos por temporadas con URLs madre diferentes. Una sola URL madre no cubre toda la serie.

### Solución
Permitir definir **bloques de episodios** por anime/idioma en el panel admin, cada bloque con su propio enlace madre Seeke. El reproductor elige automáticamente el bloque correcto según el episodio actual.

### Cambios

**1. Base de datos — nueva tabla `video_cache_blocks`**

```text
- id (uuid)
- anilist_id (int)
- slug (text)
- lang (text: 'sub' | 'lat')
- block_index (int) — orden 1, 2, 3
- block_label (text, opcional) — "Temporada 1", "Saga Reino del Trébol"
- episode_from (int)
- episode_to (int)
- seeke_base_url (text)
- created_by (uuid)
- created_at, updated_at
```

RLS: lectura pública, escritura solo admin/owner. Índice único en (anilist_id, lang, block_index).

**2. Admin — nueva pestaña "Bloques" dentro de VideoManager**

Cuando se selecciona un anime, debajo del campo "URL madre Seeke" aparece un botón **"Modo bloques"**. Al activarlo:

- Se ocultan los campos de URL única
- Aparece un editor de bloques con filas: `[Bloque 1] [Ep 1 → 51] [URL madre] [Borrar]`
- Botón "+ Agregar bloque"
- Al guardar, valida que los rangos no se solapen y cubran sin huecos
- Guarda en `video_cache_blocks` (delete + insert por (anilist_id, lang))

Si existe al menos un bloque para `(anilist_id, lang)`, los bloques tienen prioridad sobre el `episode = 0` clásico.

**3. Resolución del enlace madre — `src/lib/zetapi.ts` / `video-cache.ts`**

Nueva función `resolveSeekeBaseForEpisode(anilistId, lang, episode)`:
1. Consulta `video_cache_blocks` para `(anilist_id, lang)` ordenado por `block_index`
2. Si hay bloques → devuelve el `seeke_base_url` del bloque cuyo `episode_from <= ep <= episode_to`
3. Si NO hay bloques → fallback al comportamiento actual (`video_cache` con `episode = 0`)

El reproductor pasa el episodio actual al pedir el embed; la VPS recibe `base_url + episode_within_block` (el ep relativo al inicio del bloque, ej. ep 60 cae en bloque 2 que va 51–101 → se pide al madre como ep 10).

**4. Cache invalidation**

Cuando se editan/guardan bloques, se borra `video_cache` para `(anilist_id, lang)` y se limpia el cache runtime (igual que ya hace VideoManager con la URL madre única).

---

## Parte 2 — Nueva lógica `latest_episode`

### Cambios

**1. `src/lib/zetapi.ts`**
- `getLatestEpisodeForBase()` ya existe (TTL 30 min). Lo extendemos para que cuando hay bloques, sume los `latest_episode` de cada bloque y devuelva el total acumulado por idioma.
- Nueva función `getLatestEpisodeByLang(anilistId, lang)`:
  - Si hay bloques: pide latest a cada bloque, mapea a numeración global, devuelve el máximo absoluto.
  - Si no hay bloques: pide al único madre.
  - Cachea por idioma con TTL 30 min.

**2. `src/components/video/AnimePlayer.tsx` y `src/pages/Watch.tsx`**
- Al cargar un episodio, llamar `getLatestEpisodeByLang(id, currentLang)`.
- Mantener dos contadores en estado: `latestSub` y `latestLat`.
- Botón "Siguiente episodio":
  - Si `currentEpisode >= latestForCurrentLang` → deshabilitar y mostrar toast "No hay más episodios disponibles".
- Cuando el usuario cambia idioma (sub ↔ lat), recalcular contra `latestForCurrentLang`. Si el ep actual supera el latest del nuevo idioma, mostrar aviso.

**3. Generación de botones en AnimeDetail / BentoEpisodes**
- Reemplazar la cuenta de AniList por `Math.max(anilist.episodes, latestSub, latestLat)` para crear botones dinámicos.
- Marcar visualmente los episodios que sólo existen en un idioma (badge "SUB" / "LAT").
- Cuando `latest_episode` aumenta (refetch al volver a la página), aparecen botones nuevos automáticamente sin hardcode.

**4. NO tocar**
- Player actual (HLS, hls.js, hardCleanup)
- Sistema de embeds y subtítulos
- Renderizado del video

---

## Archivos a tocar

- `supabase/migrations/...` — crear `video_cache_blocks` con RLS
- `src/lib/zetapi.ts` — `resolveSeekeBaseForEpisode`, `getLatestEpisodeByLang`
- `src/lib/video-cache.ts` — integración con bloques
- `src/components/admin/VideoManager.tsx` — UI editor de bloques
- `src/components/video/AnimePlayer.tsx` — bloqueo siguiente episodio + selector lang
- `src/pages/Watch.tsx` — pasar latest por idioma
- `src/pages/AnimeDetail.tsx` / `BentoEpisodes.tsx` — botones dinámicos por latest máximo

## Notas
- La VPS ya devuelve `latest_episode`; el frontend confía 100% en él (sin descubrimiento m3u8).
- Los bloques se gestionan completamente en el admin; el usuario nunca los ve, sólo experimenta numeración continua.
- Combina cache local (DB) + VPS: si la DB tiene cache fresco lo usa, sino pide a VPS.
