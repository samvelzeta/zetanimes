# Plan: 13 features premium para ZetAnime

Voy a implementar las 13 ideas que elegiste (1, 3, 4, 6, 8, 9, 10, 11, 14, 15, 16, 32, 35) en **5 fases** para no romper nada. Todo lo hago con CSS/SVG generado — **no necesito que me envíes gráficos**. Yo genero marcos, banners de fallback, iconos de logros y cursores como plantillas reutilizables.

---

## ¿Qué materiales necesito de ti?

**Nada obligatorio.** Yo creo todo con:

- **Marcos de avatar** → SVG animados con CSS (neón, fuego, sakura, glitch, dorado, arcoíris). 6 plantillas iniciales.
- **Banners premium** → 8 banners generados con `imagegen` (paisajes anime abstractos) + opción de subir el propio.
- **Iconos de logros** → SVG con Lucide + variantes doradas para logros raros.
- **Cursores** → PNG 32×32 generados (katana, sombrero pirata, kunai, varita). 4 plantillas.
- **Rangos Roleplay** → nombres + iconos SVG (Genin, Chunin, Jounin, Kage, Hokage / Novato, Cazador, Capitán, Almirante).

Si más adelante quieres reemplazar cualquier plantilla por arte tuyo, es tan simple como subir a `premium-assets` bucket.

---

## FASE 1 — Base de datos y sistema XP (fundacional)

Todo lo demás depende de esto. Migración única con tablas nuevas + triggers.

### Nuevas tablas

- `**user_xp**` (`user_id`, `xp`, `level`, `rank_slug`, `updated_at`) — 1 fila por usuario.
- `**achievements**` (catálogo estático: `slug`, `name`, `description`, `icon`, `rarity`, `xp_reward`, `condition_type`, `condition_value`).
- `**user_achievements**` (`user_id`, `achievement_slug`, `unlocked_at`) — logros desbloqueados.
- `**user_cosmetics**` (`user_id`, `avatar_frame`, `name_effect`, `cursor_theme`, `banner_url`, `banner_preset`, `active_theme`) — cosméticos activos por usuario.
- `**roleplay_missions**` (catálogo: `slug`, `title`, `description`, `type`, `target`, `xp_reward`, `rank_required`).
- `**user_missions**` (`user_id`, `mission_slug`, `progress`, `completed_at`).

### Triggers automáticos

- `after_insert` en `watch_history` con `completed = true` → +50 XP + chequear logros ("primer episodio", "10 completados", "100 completados", "maratón 24h").
- `after_update` en `profile_stats` → recalcular nivel/rango del usuario y misiones activas.
- Función `award_xp(user_id, amount, reason)` para uso desde código y triggers.

### Sistema de niveles

```
Nivel 1-10:  Genin       (0-2500 XP)
Nivel 11-25: Chunin      (2500-10k)
Nivel 26-50: Jounin      (10k-30k)
Nivel 51-80: ANBU        (30k-70k)
Nivel 81-99: Kage        (70k-150k)
Nivel 100+:  Hokage      (150k+)
```

---

## FASE 2 — Cosméticos visuales (features 1, 3, 4, 6)

### 1. Marcos animados de avatar

- Componente `<AvatarFrame frame="neon" size={80}>` que envuelve cualquier `<img>` de avatar.
- 6 marcos base con CSS puro: `neon-orange`, `fire`, `sakura` (pétalos girando), `glitch` (RGB split), `gold` (shimmer), `rainbow`.
- Reemplazar todos los `<Avatar>` en: header, perfil, selector de perfiles, comentarios futuros, ranking.
- **Free:** solo marco `default` (sin animación).
- **Premium:** desbloquea marcos según nivel (Genin=neon, Chunin=fire, etc.).

### 3. Banners de perfil

- Nueva sección al tope de `/profile` (hero 200px de alto).
- 8 banners preset generados con `imagegen` (montaña Fuji, ciudad neón, océano, cerezos, etc.).
- Premium puede subir el suyo a bucket `premium-assets/banners/{user_id}`.
- Sobre el banner: avatar con marco, nombre con efecto, rango, nivel.

### 4. Nombres con efecto

- Componente `<UserName effect="shiny" name={...} />`.
- Efectos CSS: `default`, `shiny` (brillo pasando), `gradient` (fluye), `fire`, `ice`, `rainbow`.
- Se aplica en perfil, header, ranking, próximamente comentarios.

### 6. Cursor temático (solo PC)

- Cambia `cursor: url(...)` global vía CSS variable inyectada desde `PreferencesContext`.
- 4 cursores: katana, kunai, sombrero pirata, varita mágica.
- Preview interactivo en Settings → Personalización.

**UI de personalización:** nueva sección en `/settings` → "Personalización Premium" con 4 tabs (Marco / Banner / Nombre / Cursor). Cada tab muestra grid de opciones con preview en vivo; opciones bloqueadas muestran candado + nivel/plan requerido.

---

## FASE 3 — Gamificación (features 8, 9, 10, 32)

### 10. Nivel y XP

- Barra de XP visible en el header del perfil + en el selector de perfiles.
- Se llena en tiempo real cuando terminas un episodio (realtime `user_xp`).
- Animación al subir de nivel: toast "¡Subiste a Chunin! Marco 'Fire' desbloqueado".

### 9. Logros

- Nueva pestaña en `/profile` → "Logros" con grid tipo Steam.
- 20 logros iniciales: `Primer paso`, `Diez animes`, `Maratón` (5 caps seguidos), `Nocturno` (2-6am), `Otaku` (100 caps), `Coleccionista` (10 listas), `Fiel` (30 días premium), `Ambilight lover`, etc.
- Cada logro con icono, rareza (común/raro/épico/legendario), fecha desbloqueo, % de usuarios que lo tienen.
- Toast al desbloquear con confetti.

### 8. Ranking Top Fans (PARA TODOS)

- Nueva página `/ranking` con top 100 por horas vistas este mes.
- Muestra: posición, avatar con marco, nombre con efecto, nivel, horas.
- Query: `SELECT ... FROM profile_stats JOIN user_xp JOIN user_cosmetics ORDER BY total_watch_seconds DESC LIMIT 100`.
- Filtros: mes actual / all-time / por género favorito.
- Añadir enlace en el BottomNav y HeaderBar.

### 32. Modo Roleplay

- Nueva página `/misiones` (solo premium).
- Panel estilo "gremio ninja": banner temático + rango actual + XP + misiones activas.
- 3 misiones diarias rotativas + 5 semanales:
  - "Ver 3 episodios de acción" → +200 XP
  - "Completar un anime" → +500 XP
  - "Explorar 5 animes nuevos" → +150 XP
  - "Sesión maratón: 4 caps seguidos" → +400 XP
- Al completar todas las diarias: bonus + logro.
- Se resetean con función edge diaria (cron `0 0 * * *`).

---

## FASE 4 — Reproductor mejorado (features 14, 15, 16)

Todo en `src/components/video/AnimePlayer.tsx` y `ZetPlayer.tsx`.

### 14. Skip intro/outro + auto-next sin cuenta regresiva

- Ya tienes `+90s`. Añadir:
  - Botón "Skip intro" flotante entre segundos 60-120 (dismissable, se detecta por heurística inicial: primer skip que hace el usuario → guarda posición para próximos eps).
  - Botón "Skip outro" en los últimos 90s.
  - Toggle premium en Settings: "Auto-siguiente sin cuenta regresiva" → al llegar al final salta directo.

### 15. Modo cine Ambilight

- Nuevo botón en player: 🎬 Ambilight ON/OFF.
- Al activar: `<canvas>` invisible extrae color dominante cada 500ms del `<video>` frame → aplica como `box-shadow` gigante blureado alrededor del video (idéntico a YouTube Ambient).
- Solo premium. Se desactiva automáticamente en móvil bajo datasaver.

### 16. Subtítulos personalizables

- Panel de settings dentro del player (icono ⚙️ → "Subtítulos"):
  - Tamaño: 60% - 200%
  - Color texto: 8 colores
  - Color fondo: transparente / negro / semi
  - Fuente: Sans / Serif / Mono / Anime (Zen Maru Gothic)
  - Posición: bajo / medio / arriba
- Config guardada en `account_settings` (columna nueva `subtitle_prefs jsonb`).
- Se aplica vía CSS a `<track>` renderizado por el player.
- **Free:** solo tamaño. **Premium:** todo.

---

## FASE 5 — Analytics y viral (features 11, 35)

### 11. Wrapped anual exportable

- Nueva página `/wrapped/:year` (accesible desde perfil "Ver mi año en ZetAnime").
- 5 slides tipo Instagram Stories:
  1. "Viste **N horas** este año"
  2. "Tu top 5 animes"
  3. "Tu género favorito: **shonen** (73%)"
  4. "Tu día más otaku: **12 de junio con 6h**"
  5. "Rango final: **Chunin nivel 24**"
- Botón "Descargar tarjeta" → renderiza slide actual a PNG con `html2canvas` + botón share nativo.
- Datos vienen de agregación de `watch_history` filtrada por año.
- **Free:** solo ve slide 1. **Premium:** todo + descarga.

### 35. Estadísticas comparativas

- Nueva sección en `/profile` → "Cómo te comparas":
  - "Ves **3.2×** más shonen que el promedio"
  - "Estás en el **top 8%** por horas vistas"
  - "Tu racha de días activos: **14** (promedio: 3)"
- Query agregada al cargar perfil (cache 1h en localStorage).

---

## Detalles técnicos

**Nuevos archivos principales:**

```
src/components/premium/AvatarFrame.tsx
src/components/premium/UserName.tsx
src/components/premium/ProfileBanner.tsx
src/components/premium/XPBar.tsx
src/components/premium/LevelUpToast.tsx
src/components/premium/AchievementCard.tsx
src/components/premium/AmbilightCanvas.tsx
src/components/premium/SubtitleSettings.tsx
src/components/premium/CosmeticsPicker.tsx
src/pages/Ranking.tsx
src/pages/Missions.tsx
src/pages/Wrapped.tsx
src/pages/Achievements.tsx
src/lib/xp-system.ts
src/lib/achievements-catalog.ts
src/lib/missions-catalog.ts
src/lib/cosmetics.ts
src/hooks/useUserXP.ts
src/hooks/useUserCosmetics.ts
src/hooks/useAmbilight.ts
src/index.css  (keyframes de marcos + name effects)
supabase/functions/reset-daily-missions/index.ts
```

**Assets generados con `imagegen`:**

- 8 banners premium (1920×480)
- 4 cursores temáticos (32×32 PNG)
- Iconos únicos para 5 logros legendarios

**Rendimiento:**

- Ambilight solo activo cuando el video está visible + throttled a 2fps.
- Marcos animados usan `transform` + `will-change` para no forzar reflow.
- Realtime XP/logros usa canal único `user-progress-${user_id}`.

---

## Orden de ejecución (5 mensajes)

1. **Fase 1** — Migración DB completa (tablas, triggers, catálogos seed).
2. **Fase 2** — Cosméticos (marcos, banner, nombre, cursor) + UI de personalización.
3. **Fase 3** — XP visible, logros, ranking público, misiones roleplay.
4. **Fase 4** — Mejoras del reproductor (skip inteligente, Ambilight, subtítulos).
5. **Fase 5** — Wrapped + estadísticas comparativas.

Cada fase es independiente y funcional por sí sola — puedes probar y darme feedback entre fases.

---

**¿Apruebas el plan?** Si sí, arranco con la Fase 1 (migración de base de datos). Si quieres cambiar algo (quitar features, reordenar, ajustar rangos/XP, cambiar nombres de rangos por temática pirata o cazadores en lugar de ninja), dime antes.  
  
  
¡Qué gran análisis estás haciendo de la política de *Tensura*! Tienes un par de confusiones comprensibles con los nombres y las intenciones de Rimuru, pero diste justo en el clavo con lo del manga y las novelas. En el anime recortan muchísima política.

Vamos a poner las cosas en orden, separando al **Reino de Blumund** del **Reino de Falmuth** (que son dos países totalmente distintos), y te detallo cómo fue ese tratado.

## 1. El Rey de Blumund: ¿Un genio o un apostador?

El Rey de Blumund (Drum Blumund) fue **extremadamente inteligente y un visionario**. En las novelas ligeras y el manga se explica que, aunque parece un hombre gordo, bonachón y algo despreocupado, en realidad es un estratega brillante y un apostador político audaz.

Su esposa, la reina, es el cerebro lógico de la nación. Juntos analizaron la situación y se dieron cuenta de algo que los grandes reinos ignoraron por arrogancia: **Tempest iba a convertirse en una superpotencia**, y estar del lado bueno de Rimuru desde el principio salvaría a su pequeño país.

### ¿Es verdad que Rimuru afirmó que Blumund fue el primero en apoyarlos?

**Sí, es totalmente verdad.** Rimuru le tiene un aprecio enorme a Blumund por esto. Cronológicamente:

1. **Dwargon** (el reino enano) fue el primero en firmar un tratado de amistad, pero manteniéndose técnicamente neutrales ante el mundo humano para cuidar su estatus.
2. **Blumund fue el primer reino humano en reconocer formalmente a Tempest como una nación soberana** y en arriesgar su reputación frente a la Iglesia Occidental.
  Reddit
  &nbsp;

Cuando Falmuth atacó Tempest, Blumund no se escondió: el gremial Fuze llegó a Tempest con soldados para apoyar y el Rey condenó públicamente las acciones de Falmuth. Rimuru nunca olvidó ese gesto de lealtad cuando era "solo un monstruo".

## 2. ¿Rimuru le tiene cariño a Falmuth?

Aquí es donde está la confusión de nombres: **No, Rimuru no le tiene ningún cariño al Falmuth original.**

Al Falmuth del Rey Edmaris (el que ordenó la masacre en Tempest) Rimuru lo destruyó militarmente (usando su magia *Megiddo* y cosechando sus 20,000 almas para convertirse en Demon Lord). Rimuru sentía desprecio por la codicia de ese reino.

Wikipedia

&nbsp;

A quien Rimuru **sí le tiene un cariño tremendo es a Youm**, quien era el líder de la fuerza fronteriza. Lo que hizo Rimuru, usando a Diablo como mente maestra, fue armar un plan político para disolver el corrupto reino de Falmuth y reconstruirlo desde las cenizas bajo el mando de Youm. El nuevo reino pasó a llamarse **Reino de Farmenas**. A este nuevo país títere sí lo cuida y lo apoya económicamente.

## 3. El Tratado con Falmuth (Lo que el anime recortó)

En el manga y las novelas, las negociaciones tras la derrota de Falmuth son mucho más densas y un absoluto despliegue del terror político de Diablo.

Cuando el Rey Edmaris fue devuelto a su reino (sano, pero traumatizado tras haber sido convertido en un bloque de carne por Shion), Diablo se presentó ante la corte de nobles de Falmuth y les puso un tratado de capitulación sobre la mesa con tres opciones despiadadas:


| Opción                           | Lo que implicaba                                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Abdicación y Reparaciones** | El Rey Edmaris debía abdicar. El reino debía reconocer a Tempest, pagar una suma astronómica de indemnización de guerra, y ceder tierras. |
| **2. Convertirse en vasallos**   | Falmuth perdería su soberanía y pasaría a ser una provincia gobernada directamente por Tempest.                                           |
| **3. Continuar la guerra**       | Diablo les dejó claro que si elegían esta, él mismo erradicaría el reino entero al día siguiente.                                         |


### El verdadero plan detrás del tratado

Los nobles de Falmuth, en su orgullo, intentaron buscar una cuarta opción: aceptaron que el Rey Edmaris abdicara y que subiera su hermano (Edward), pero planearon traicionar el acuerdo de las reparaciones de guerra y culpar a Tempest usando a la Iglesia Occidental.

Todo esto iba **exactamente de acuerdo al plan de Diablo**. Él sabía que los nobles se dividirían, causando una **guerra civil**. En medio de ese caos, **Youm** emergió como el héroe del pueblo que detendría la guerra civil, ganándose el derecho legítimo al trono con el apoyo militar secreto de Tempest.

### El Tratado Definitivo con Farmenas (El nuevo reino)

Una vez que Youm se convirtió en rey y Falmuth pasó a ser Farmenas, el tratado real se firmó:

- **Perdón de la deuda:** Rimuru perdonó la gigantesca deuda de guerra que Falmuth le debía a Tempest para que el nuevo gobierno de Youm no naciera en la quiebra.
- **Tratado de No Agresión y Alianza:** Farmenas se convirtió en un estado aliado/protectorado de Tempest.
- **Ruta Comercial y Tren Mágico:** Farmenas cedió los derechos para que Tempest construyera su red de transporte logístico (incluyendo el tren mágico), conectando Dwargon, Tempest, Blumund y Farmenas en un monopolio comercial absoluto que dejó fuera de juego a las naciones occidentales corruptas.
  Reddit
    
    
  otra cosa, me he dado cuenta que mejor seria que anularas el de skip automatico, ya que no sabemos en que seguno exacto se encuentran los op y ending asi que ese queda total mente anulado y todo lo demas aprovado siguiendo las sugerencias dadas anteriormente