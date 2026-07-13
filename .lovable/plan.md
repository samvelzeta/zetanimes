
# Ocultar URLs madre del inspector (Network + Console)

## Contexto del problema

Ahora mismo la URL madre (`https://video.playspelis.com/...`) es visible en el navegador por **tres vías**:

1. `console.log("[seeke] resolve start", { url, ... })` — **ya arreglado** en el turno anterior.
2. **POST directo desde el navegador a `a24785-ef25.xs001.jrnm.app/extraer`** con `{ url, ep }` en el body (visible en Network → Payload).
3. **SELECT a `video_cache` y `video_cache_blocks`** desde el navegador — la tabla devuelve `sources.seeke[0]` y `seeke_base_url` como texto plano (visible en Network → Response).

Para que sea imposible verlas ni con DevTools ni con proxies tipo mitmproxy, hay que cortar las tres vías.

## Plan

### 1. Edge function `resolve-stream` (nueva)

Ubicación: `supabase/functions/resolve-stream/index.ts`. Corre server-side con `service_role`, invisible al usuario.

Recibe:
```json
{ "action": "episode" | "latest", "anilistId": 180136, "lang": "sub", "ep": 1 }
```

Lógica interna:
- Con `service_role`, consulta `video_cache_blocks` para (anilistId, lang). Si hay bloques, encuentra el que contiene `ep` y aplica offset/inverse igual que `resolveSeekeBaseForEpisode`.
- Si no hay bloques, lee `video_cache.sources.seeke[0]` (episode=0) como URL madre por defecto.
- Con la URL madre resuelta, hace el POST a la VPS scraper (`SEEKE_BOT_URL`) desde el servidor.
- Devuelve solo lo purificado: `{ ok, embed, episode, subtitles, qualities, latest_episode }`. Nunca devuelve la URL madre ni la URL de la VPS.

Se despliega con `verify_jwt = false` para no romper visitantes anónimos, pero se protege con rate limit por IP (tabla ligera `rl_resolve_stream` o header check simple).

### 2. Frontend: dejar de mandar la URL

- `src/lib/zetapi.ts`
  - Nuevas funciones `resolveStreamEpisode(anilistId, lang, ep)` y `resolveStreamLatest(anilistId, lang)` que llaman `supabase.functions.invoke("resolve-stream", ...)`.
  - `getSeekeEpisode(url, ep)` / `getLatestEpisodeForBase(url, ep)` quedan como legacy solo para el panel admin (`ApiDebugPanel`).

- `src/components/video/AnimePlayer.tsx`
  - Recibe nueva prop `anilistId` y `lang`.
  - El bloque `if (currentSource.type === "seeke")` llama `resolveStreamEpisode(anilistId, lang, requestedEp)` en vez de `getSeekeEpisode(requestedUrl, ...)`. La URL de `currentSource.url` deja de leerse.

- `src/pages/Watch.tsx`
  - Pasa `anilistId` y `lang` al `<AnimePlayer />`.

- `src/lib/video-blocks.ts`
  - `getLatestEpisodeByLang` llama a `resolveStreamLatest(anilistId, lang)` en vez de iterar bloques y pedir URLs desde el cliente.

### 3. Lockdown de RLS: dejar de exponer las URLs madre

Migración que:
- `video_cache_blocks`: quita SELECT a `anon` y `authenticated` (solo admin/owner). Crea RPC `has_video_blocks(_anilist_id int, _lang text) returns boolean` para que el frontend sepa "hay bloques" sin ver las URLs.
- `video_cache`: reemplaza la SELECT pública por una **vista** `public.video_cache_public` que expone todo excepto la clave `seeke` dentro de `sources` (`sources - 'seeke'`). El frontend consulta la vista; el edge function usa la tabla real vía service_role.

Como `video_cache` es leída en muchos sitios (`video-cache.ts`, `Watch.tsx`, `useDubbedAnimes`, admin), la vista debe ser drop-in: mismos columnas, mismo nombre de campos, pero `sources.seeke` no aparece. Los checks tipo `hasSeekeSources` se sustituyen por una columna calculada `has_seeke boolean` en la vista.

Los flags booleanos que la lógica de Watch usa (`hasCurrentSeekeConfig`, `currentSeekeAvailableForEpisode`, etc.) ya no necesitan la URL, solo saber si existe → se derivan del boolean.

### 4. Verificación

Playwright headless: cargar la home, ir a un `/watch/...`, y confirmar que en las network requests capturadas:
- No aparece `a24785-ef25.xs001.jrnm.app` ni ningún dominio `playspelis.com`.
- La única llamada visible relacionada es `POST /functions/v1/resolve-stream` con body `{ anilistId, lang, ep }`.
- Los payloads de `video_cache`/`video_cache_blocks` no incluyen `seeke_base_url` ni `sources.seeke`.

## Detalles técnicos

- La VPS scraper (`SEEKE_BOT_URL`) sigue funcionando tal cual, sin tocar Python.
- El edge function usa `SUPABASE_SERVICE_ROLE_KEY` (ya está en secretos) para leer las tablas restringidas.
- Cache: el edge function puede cachear en memoria por `(anilistId, lang, ep)` durante 30–60s para reducir llamadas a la VPS.
- Fallback: si el edge function falla, el player muestra "servidor no disponible" — no cae al método directo del navegador (eso rompería el ocultamiento).
- `ApiDebugPanel` (solo admin) sigue con las funciones directas para permitir depurar URLs específicas.

## Riesgo

- La vista `video_cache_public` debe replicar exactamente las columnas usadas por el frontend; cualquier query que espere `sources.seeke` no funcionará en el navegador (correcto: eso es lo que queremos).
- Si algún componente del frontend (fuera del player) todavía necesita saber la URL madre para algo, tendría que migrarse — voy a auditar antes de aplicar.

¿Aplico este plan?
