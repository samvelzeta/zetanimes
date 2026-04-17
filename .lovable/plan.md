
El usuario quiere optimización agresiva de carga para que no se trabe en TV, móvil, ni PC. Ya tenemos LazyImage con IntersectionObserver, pero el Home carga TODAS las secciones a la vez (8+ queries simultáneas a AniList) y todos los componentes se montan inmediatamente.

Voy a revisar qué tenemos y proponer un plan de optimización integral.

## Diagnóstico actual

**Problemas detectados:**
1. **Home monta 10+ secciones de golpe** (HeroBanner, LatestEpisodes, BentoEpisodes, GenreList, SphereCarousel x2, FocusCarousel, TopRanking, HorizontalList x3, AnimeRoulette) — todas hacen fetch al mismo tiempo.
2. **8 queries paralelas a AniList** al cargar Home (trending, popular, topRated, season, action, fantasy + recientes + bento).
3. **LazyImage existe pero no se usa en todos lados** (HeroBanner, BentoEpisodes, FocusCarousel, SphereCarousel, TopRanking usan `<img>` directo).
4. **Componentes pesados se renderizan aunque estén fuera de pantalla** (AnimeRoulette, FocusCarousel con animaciones).
5. **Animaciones siempre activas** (anillos giratorios, halos pulsantes) consumen GPU continuamente aunque no se vean.
6. **No hay code-splitting por ruta** — todo el bundle se carga al inicio.

## Plan de optimización

### Fase 1 — Lazy mount de secciones del Home (mayor impacto)
Crear `<LazySection>` que solo monta su contenido cuando entra al viewport (con `rootMargin: 600px` para precarga suave). Aplicar a TODAS las secciones del Home excepto HeroBanner y LatestEpisodes (above-the-fold).

**Resultado:** Home inicial solo dispara 2 queries en vez de 8. El resto se carga al hacer scroll.

### Fase 2 — LazyImage en todos los componentes
Reemplazar `<img>` por `<LazyImage>` en:
- `HeroBanner` (background images stacked)
- `BentoEpisodes` (5 covers)
- `FocusCarousel` (5 visibles)
- `SphereCarousel` (3 visibles)
- `TopRanking` (10 thumbs)

### Fase 3 — Pausar animaciones fuera de viewport
Crear hook `useInViewport` y aplicarlo a SphereCarousel/FocusCarousel para que las animaciones (`animate-spin`, `animate-pulse`, autoplay timers) se PAUSEN cuando la sección no está visible. En TV ya están desactivadas, ahora también en móvil/PC cuando no se ven.

### Fase 4 — React Query optimizado
- Subir `staleTime` de 10min a 30min en Home queries (los datos de AniList no cambian tan rápido).
- Activar `gcTime: 1h` para que no re-fetcheen al volver a Home.
- Mantener IndexedDB cache que ya existe.

### Fase 5 — Code-splitting de rutas
Convertir las rutas de `App.tsx` a `React.lazy()` con `Suspense`:
- `/admin`, `/watch`, `/anime/:id`, `/directory`, `/search`, `/profile`, `/settings`, `/auth`, `/recent`, `/download`, `/terms`
- Inicio carga solo Home + Layout (bundle inicial mucho más pequeño).

### Fase 6 — Imágenes responsive
- Usar `coverImage.large` (no `extraLarge`) en thumbnails pequeños (TopRanking, side cards de SphereCarousel).
- Agregar `decoding="async"` y `fetchpriority="low"` a imágenes lejanas.

## Detalles técnicos

**Archivos nuevos:**
- `src/components/LazySection.tsx` — wrapper con IntersectionObserver para montar children solo cuando entran al viewport.
- `src/hooks/useInViewport.ts` — hook que devuelve `boolean` para pausar animaciones/autoplay.

**Archivos modificados:**
- `src/App.tsx` — `React.lazy` + `Suspense` con fallback skeleton.
- `src/pages/Home.tsx` — envolver secciones con `<LazySection>`, subir staleTime/gcTime.
- `src/components/anime/HeroBanner.tsx` — LazyImage en backgrounds + thumbs.
- `src/components/anime/BentoEpisodes.tsx` — LazyImage.
- `src/components/anime/FocusCarousel.tsx` — LazyImage + pausar autoplay con useInViewport.
- `src/components/anime/SphereCarousel.tsx` — LazyImage + pausar anillo giratorio + autoplay con useInViewport.
- `src/components/anime/TopRanking.tsx` — LazyImage + `large` en vez de `extraLarge`.

**Sin cambios visuales** — todo es transparente para el usuario, solo se siente más fluido.

## Resultado esperado
- Bundle inicial ~40% más pequeño (code-splitting).
- 75% menos queries paralelas al cargar Home (de 8 a 2 inicialmente).
- 60% menos memoria en uso por imágenes (lazy + unmount).
- 0 animaciones consumiendo GPU cuando no se ven.
- TV: aún más liviano (las queries deshabilitadas con `enabled: !isTV` siguen igual).

<lov-actions>
<lov-suggestion message="Aprobado, implementá las 6 fases de optimización">Aprobar plan completo</lov-suggestion>
<lov-suggestion message="Solo implementá Fase 1 (lazy mount secciones) y Fase 5 (code-splitting rutas) que son las de mayor impacto, el resto después">Solo lo más impactante</lov-suggestion>
<lov-suggestion message="Antes de implementar, corré un performance profile en el Home actual para tener métricas baseline y comparar después">Medir antes de optimizar</lov-suggestion>
</lov-actions>
