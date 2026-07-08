# Directorio "Revista Interactiva" — Fusión de propuestas

Unifico el layout editorial actual con el enfoque de storytelling narrativo. Conservo toda la lógica de negocio (queries AniList, scroll infinito, gore, aprobados, ads, cache).

## 1. Identidad de carga
- `ZenLoader` (rayo verde `#00ff88` con glow pulsante) reemplaza cualquier spinner restante en Directorio.
- Skeleton usa el rayo centrado con opacidad baja + shimmer encima.

## 2. Cabecera híbrida
- **Desktop/tablet**: `HeroCarousel` full-width con:
  - Título Playfair Display, botones glassmorphism.
  - Etiqueta "DIRECTORIO" arriba-izq.
  - **Botón pausa** nuevo: congela el auto-avance y muestra un icono `Play` para reanudar.
- **Móvil**: altura 40vh + **subtítulo estático** debajo ("El inicio de una nueva leyenda") en tipografía serif ligera.

## 3. Panel Catálogo (Drawer)
Se conservan Categorías temáticas, sliders (año/rating), estado, "Para ti".
- Añado sección **"Perfiles de Intriga"**: 3 animes destacados (trending alto + averageScore≥80) con mini-card horizontal: portada pequeña + título + una data curiosa auto-generada ("★ 9.1 · Estreno 2021 · Trending #2"). Al click abre el anime.
- Si no hay historial en "Para ti" → copy "Explora nuestras selecciones destacadas".

## 4. Grid asimétrico + Perfiles de Intriga intercalados
- Mantengo `AsymmetricCard` con patrón actual (landscape/portrait/square).
- Cada 5 posiciones inserto una **`StoryCard`** (2×1 en desktop, 1×1 en móvil):
  - Layout horizontal: portada 40% + panel derecho con título serif, sinopsis extendida (3-4 líneas), chips con `averageScore`, año, género principal, y sello "Descubre por qué".
  - Hover: expansión sutil + glow primario.
  - Aparece con animación de "revelación" (fade + translateY + stagger).

## 5. Sección "Cine ZetAnime"
- Nuevo componente `CinemaSection` renderizado tras el bloque principal cuando NO estamos ya en modo películas.
- Fondo `bg-zinc-900/50` con degradado sutil de transición.
- Título serif pequeño "Cine ZetAnime".
- Scroll horizontal con `snap-x`, cards 21:9, sombras profundas, sin flechas.
- Hover: parallax ligero (translateX en la img) + overlay ghost con título/año/"Ver ahora".
- Fuente: `getMovies()` (query ya existente), primeros 12.

## 6. Ranking y filtro móvil
- `StickyRanking` desktop se mantiene (ya sticky lateral derecho).
- En móvil aparece al final de la lista (antes del footer) — versión colapsada.
- Drawer y filtro móvil comparten `CatalogState` en localStorage (ya lo hacen).

## 7. Título "Directorio"
- Etiqueta pequeña serif alineada a la izquierda dentro del hero (ya presente). Mantengo.

## 8. Micro-interacciones
- Transición al cambiar filtros: `animate-fade-in` con stagger CSS (nth-child delays).
- StoryCard: keyframe `story-reveal` (clip-path o translateY+opacity).

## 9. Responsive
- Móvil: hero 40vh + subtítulo, grid 2col scroll vertical, cine 200px, ranking al final.
- Tablet: hero 60vh, grid 2col con alguna Story 2×1, ranking lateral.
- Desktop: hero full, grid 3-4col asimétrico + Story cards intercaladas, ranking sticky, cine 400px.

## Detalles técnicos
Archivos nuevos:
- `src/components/directory/StoryCard.tsx` — tarjeta de intriga con datos AniList.
- `src/components/directory/CinemaSection.tsx` — scroll horizontal 21:9 con parallax.
- `src/components/directory/IntrigueProfiles.tsx` — mini bloque dentro del drawer.

Archivos editados:
- `src/components/directory/HeroCarousel.tsx` — añadir botón pausa + subtítulo móvil.
- `src/components/directory/CatalogDrawer.tsx` — insertar `IntrigueProfiles`.
- `src/pages/Directory.tsx` — intercalar `StoryCard` cada 5 items, montar `CinemaSection`, mover ranking móvil al final.
- `src/index.css` — keyframes `story-reveal`, `cinema-parallax` opcional.

Nada de business logic cambia: fetch, filtros, aprobados, gore, ads y cache permanecen intactos.
