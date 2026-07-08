# Rediseño del Directorio — Experience-First

Cambio grande y visual del `src/pages/Directory.tsx`. Se mantiene toda la lógica de datos (AniList queries, filtros ocultos, gore, scroll infinito de películas, aprobados, ads) — solo cambia la capa de presentación.

## 1. Hero Carousel Editorial (arriba)

- Reemplaza el título "Directorio" + botón Filtros por un carrusel full-width.
- Alturas: `100vh` desktop, `60vh` tablet, `50vh` móvil.
- Fuente: top 5-6 animes de `getTrending` (ya cacheado).
- Cada slide: banner alta resolución con `blur-sm` sutil + gradiente negro inferior + título en fuente serif (Playfair Display o Cinzel via Google Fonts), sinopsis corta, botón "Ver detalles" con glassmorphism (`backdrop-blur bg-white/10`).
- Autoplay 6s, dots + flechas laterales en desktop.
- Etiqueta "DIRECTORIO" pequeña, ligera, esquina superior izquierda superpuesta como firma.

## 2. Panel Catálogo Inteligente (Drawer lateral)

- Botón "Catálogo" flotante: esquina sup-der en desktop/tablet, FAB inferior-der en móvil.
- Drawer con `Sheet` de shadcn (ya disponible) — side="right" desktop, side="bottom" móvil.
- Fondo glassmorphism oscuro (`bg-black/70 backdrop-blur-xl`).
- Contiene tres bloques:
  **A) Categorías Temáticas** (mapeadas a géneros AniList existentes):
  - El despertar de los héroes → Action + Adventure
  - Oscuridad pura → Horror + Psychological + Thriller
  - Viajes inolvidables → Adventure + Fantasy
  - Venganza y redención → Drama + Thriller
  - Mundos de fantasía → Fantasy + Supernatural
  - Ciencia ficción profunda → Sci-Fi + Mecha
  **B) Filtros avanzados** — sliders año (2000-actual) y rating (0-10) + botones estado (En emisión / Finalizado / Todos).
  **C) Recomendaciones "✨ Para ti"** — basadas en historial local (`recently-watched` / likes en localStorage). Si no hay historial → top rated como fallback. Tarjetas horizontales pequeñas.
- Persistencia: estado en `localStorage` key `zet:directory-catalog`.

## 3. Bento Grid Asimétrico

- Desktop (≥1024px): grid de 3 cols, primer item ocupa 2x2, resto 1x1. Aspect 2:3.
- Tablet (768-1023px): 2 cols uniformes.
- Móvil (<768px): scroll vertical de tarjetas anchas al 90%, con overlay siempre visible (título + sinopsis corta sobre gradiente).
- Cada tarjeta:
  - Sin texto estático debajo.
  - Overlay con gradiente `from-black/90 to-transparent` con título + sinopsis 80 chars, visible en hover (desktop) o siempre (móvil).
  - Hover: `scale-105`, halo/glow del `--primary`, transición 0.3s.
- Skeleton shimmer animado mientras carga (keyframe `shimmer` horizontal).

## 4. Micro-interacciones

- Transiciones al cambiar filtro/categoría: fade + stagger 50ms usando animaciones CSS existentes (`animate-fade-in`).
- Scroll suave.

## Detalles técnicos

- Nuevo componente `src/components/directory/HeroCarousel.tsx`.
- Nuevo componente `src/components/directory/CatalogDrawer.tsx`.
- Nuevo componente `src/components/directory/BentoAnimeCard.tsx`.
- `Directory.tsx` reescrito para orquestar los 3 bloques y mantener las queries existentes (AniList + hidden + approved + películas infinite).
- Fuente serif: agregar `<link>` Google Fonts (Playfair Display) en `index.html` y clase util en `index.css`.
- Keyframe `shimmer` en `index.css`.
- Se conservan `AdBannerInline` entre filtros y grid, filtros gore, hidden animes.

## Fuera de alcance

- Feedback háptico/sonoro (opcional, se omite).
- Sincronía carrusel↔grid ("si slide es AoT, primera fila destaca relacionados") — se omite en esta iteración; el grid sigue reaccionando a categoría/filtros del drawer, no al slide activo.

ajustes y sugerencias extras para tener en cuenta y sera el veredicto final:  
Ajuste al "Hero Carousel"

- **Sugerencia:** Asegúrate de que, en móvil, el carrusel no ocupe tanto espacio. El **50vh** que propone la IA puede ocultar demasiado contenido importante en pantallas pequeñas (el usuario quiere ver el "Directorio" rápido).
- **Corrección sugerida:** "En móvil, limita el Hero Carousel a **40vh** y asegúrate de que el título no sea tan grande que tape la imagen, para que el usuario siempre vea un adelanto del contenido de abajo."

### 2. Sobre el "Bento Grid" (Efectos de texto)

- **Sugerencia:** En el diseño que propone la IA para móvil, dice que la sinopsis estará "siempre visible" sobre el gradiente. En móvil, eso a veces puede saturar la pantalla pequeña y hacer que el diseño se sienta desordenado.
- **Corrección sugerida:** "En móvil, haz que la sinopsis sea **colapsable o limita el texto a 2 líneas** para que la imagen del anime mantenga el protagonismo, y solo muestra el título claramente."

### 3. Integración de tus proyectos (Zen y Zani)

- **Oportunidad:** Como estás usando a tus mascotas Zen y Zani para tus proyectos, ¿por qué no le pides que, en el **Skeleton Loading** (cuando las imágenes están cargando), el efecto de "shimmer" o carga tenga un icono minimalista de Zen o Zani animado? Es un detalle de *branding* que las grandes empresas no dejan pasar.

### ¿Cómo proceder?

Si estás de acuerdo con esto, responde a la IA con este mensaje para cerrar el plan y comenzar la implementación:

> "La propuesta está excelente. Solo haz estos dos ajustes finales:
>
> 1. En móvil, ajusta el Hero Carousel a **40vh** para no ocultar demasiado el directorio.
> 2. En el grid móvil, limita la sinopsis a **2 líneas** para mantener el diseño limpio.
> 3. **Detalle Pro:** En el esqueleto de carga (skeleton loading), usa un icono sutil de mis mascotas (Zen o Zani) como parte de la animación de carga.
>
> Procedemos con la implementación tal cual lo detallaste."