# Plan por bloques

Voy a dividir todos tus pedidos en 6 bloques. Después de aprobar, empiezo por el **Bloque 1** y avanzo secuencialmente. Si se cortan los créditos, retomamos en el bloque siguiente sin perder contexto.

---

## Bloque 1 — Exportación Excel + arreglo emisión + carrusel real
1. **Exportar Excel** en Descargas → pestaña "Completados":
   - Botón "Exportar" abre modal con opciones: Todos · Solo películas · Solo en emisión · Solo finalizados · Solo con enlaces · Por año.
   - Genera `.xlsx` con: título, romaji, estado, tipo, episodios, año, géneros, slug, links guardados.
2. **En emisión → "Añadir a Ver después"** en lugar de "Ver ahora" (en cards de Home / Directorio / Search).
3. **Reemplazar `MarqueeText`** por un **carrusel real continuo** (loop derecha → izquierda sin fade). Pausa al hover/tap. Se aplica automáticamente en las mismas ubicaciones (AnimeCard, VideoManager, DownloadTracker).

## Bloque 2 — Home hero + Similares + variedad semanal
1. **Título del hero (Home)**: si supera 100 caracteres → recorte con "…" (igual que la descripción).
2. **Sección "Similares" en /anime/:id**:
   - Eliminar `SIDE_STORY`, `OTHER`, `SUMMARY`, `CHARACTER`, `SPIN_OFF`.
   - Mantener solo `SEQUEL` y `PREQUEL` en **2 paneles anchos** (uno al lado del otro / apilados en móvil) con la imagen de la temporada correspondiente y el texto "Secuela" / "Precuela" superpuesto.
3. **Acción / Fantasía / Descubre**:
   - Rotación semanal determinista (seed = año-semana) para variar animes.
   - Mezcla finalizados + en emisión, evita repetir los "clásicos" (blacklist configurable de IDs sobre-usados).
   - Sigue respetando `hidden_home_animes`.

## Bloque 3 — Player rediseñado
1. Quitar marco decorativo → player ocupa **todo el ancho** (edge-to-edge en móvil).
2. Mantener la **línea de color** (borde/acento) también en fullscreen.
3. **Botón de volver** superpuesto arriba-izquierda dentro del player, con hit-area limitado a esa esquina (no interfiere con controles).
4. **Selector de temporada desplegable dentro del player** (chip arriba, junto al título).

## Bloque 4 — Nuevo listado de capítulos
1. Rediseño estilo imagen 2:
   - **Imagen del capítulo a la izquierda**, texto a la derecha (número + título).
   - **Sin ícono de descarga**.
   - Imagen: intenta thumbnail de AniList (`streamingEpisodes.thumbnail`); si no existe usa el cover del anime con crop 16:9 consistente.
2. Este bloque de capítulos se muestra:
   - **Debajo de la sinopsis** en la página de info.
   - **Dentro del player** (colapsable) en la vista de Watch.
3. Títulos y romaji: si > 100 chars → colapsado con "…" y botón "Ver más".

## Bloque 5 — Likes por anime (ligero)
1. Tabla `anime_likes` mínima: `anilist_id`, `user_id`, `created_at` (PK compuesta).
2. RLS: usuario solo ve/edita sus propios likes; conteo público vía view/RPC.
3. Botón corazón en la card de info del anime + contador comprimido (13.1K).

## Bloque 6 — Pulido y verificación
1. Revisar responsive de todo lo anterior.
2. Reemplazar todas las referencias sobrantes a `MarqueeText`.
3. Corregir warnings de tipos.
4. Screenshot con Playwright de las 3 vistas clave (Home hero, /anime/:id, /watch, /download tab completados).

---

**Empiezo por el Bloque 1 apenas confirmes.** Si prefieres cambiar el orden o quitar algo, dímelo antes.
