# Plan: Sección 18+, Conexiones Admin, VPS Manual, Pendientes mejorado, Bento relleno

## 1. Habilitar contenido 18+ (Hentai) — solo para sección admin

- Crear función `getAdultAnime()` en `anilist.ts` que consulte AniList con `isAdult: true`.
- **No modificar** las queries existentes del Home/Search/Directorio — siguen con `isAdult: false`.
- Crear componente `src/components/admin/AdultPendingManager.tsx` con la misma lógica de Pendientes pero exclusivo para anime 18+.
- Agregar tab "18+" en el admin sidebar bajo "Contenido".
- Los animes 18+ aprobados se guardan en `approved_animes` con una columna o flag (o se usa un listado separado) para que nunca aparezcan en Home/Search/Relacionados públicos, (no apareceran si no han sido aprovados alli, crear un boton para aprovar por medio de enlace seeke o slug) estos animes solo aparecen si en ajjustes el usuario desactiva el filtro para adultos y saldra una ventana alert indicando que si esta seguro y diciendole que confirma bajo sus propios terminos que es mayor de edad, boton soy mayor de edad, y boton cancelar, hacer funcional  el boton de ajustes con todo esto, y verificar la funcionalidad de los demas otones de ajustes que esten vinvualado a algo.

1/2: verificar los cosmeticos banner, maarco, texto del titulo del nombre, etc, que funcione para el usuario , bloqueado si no lo ha obtenido del gachapon, premium o xp.

hay un problema con el gachapon, sucede que el sistema pity de probabilidades noesta ciendo lo mas bajo posible y esta regalando muy rapido los baners y marcos secretos y lujosos, verificar que el sistema del banner y del marco sean con las probabilidades ams bajas posibles al estilo casino de maquina, usar o mejorar el softare que tiene para el sistema de recompensas y evitar que el usuario gane las cosas faciles

&nbsp;

top semanal solo hay 2 animes, verificar porque no aaparecen los demas, no se esta haciendo la llmaada a anilist de loos tops animes 

## 2. Reorganizar admin: menú "Conexiones"

- Agrupar en una nueva sección del sidebar llamada "Conexiones" los items de backend:
  - VPS Config (nuevo)
  - API Keys (existente)
  - API JSON / Debug (existente)
- Mover estos items del grupo "Sistema" al nuevo grupo "Conexiones".
- subir todas las imagenes estaticas que no tienen cambio a kv y cachearlo si es posible de por vida 

## 3. Sección VPS Config en Admin

- Crear `src/components/admin/VpsConfigManager.tsx`.
- Leer/escribir la URL de la VPS en la tabla `app_settings` (key = `vps_extractor_url`).
- Al guardar, actualizar el secret `VPS_EXTRACTOR_URL` en las edge functions via `app_settings`.
- La edge function `resolve-stream` leerá dinámicamente de `app_settings` en vez de hardcodear la URL.

## 4. Mejorar Pendientes — más fuentes y random

- Agregar queries adicionales a AniList en PendingApproval:
  - `getRandomFinished()` — anime FINISHED random (sort: POPULARITY_DESC con page random).
  - Fetch de más páginas de RELEASING (actualmente 3, subir a 5).
- Partición en la UI: tabs separados para "En Emisión", "Finalizados/Random", "Relacionados".
- Los relacionados de cada anime (recommendations de AnimeDetail) se inyectan al pool de pendientes automáticamente.

## 5. Bento grid sin huecos — rellenar con finalizados

- En `BentoEpisodes.tsx`: si tras filtrar `RELEASING` quedan menos items que el máximo, rellenar con animes `FINISHED` aprobados de la reserva (tabla `pending_anime_reserve` con `reserve_state = 'consumed'` o `approved_animes`).
- Priorizar siempre RELEASING; finalizados son auxiliar temporal.
- Si un nuevo anime en emisión se aprueba, desplaza al finalizado automáticamente.

## 6. Tabla `app_settings` — insertar key VPS

- Insertar row `vps_extractor_url` con valor actual `https://a24785-7a2f.xs1.onjrnm.link` usando run_sql.

## Orden de implementación

1. Tabla + setting VPS → migration/run_sql
2. VpsConfigManager + resolve-stream dinámico
3. Reorganizar sidebar admin (Conexiones)
4. Función `getAdultAnime` + AdultPendingManager + tab 18+
5. Mejorar Pendientes (más fuentes, partición)
6. BentoEpisodes relleno con finalizados