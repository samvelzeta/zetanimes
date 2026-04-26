---
name: Sistema de perfiles, dispositivos y PIN
description: Free 2 perfiles / Premium 3, primer perfil auto-creado, selector forzado tras login, PIN individual SHA-256
type: feature
---

## Sistema completo de perfiles + dispositivos + PIN

**Tablas:**
- `account_profiles` (cap DB 3 vía trigger `enforce_max_profiles`): name, avatar_url (URL string a imagen de AniList, no se guarda blob), accent_color, font_family, is_default, **`pin_enabled`** + **`pin_hash`** (PIN INDIVIDUAL por perfil, SHA-256 con sal `zet-profile:{profileId}:{pin}`).
- `device_sessions` (UNIQUE user_id+device_id): device_name, platform, last_active_at. "Activo" = últimos 7 días.
- `account_settings`: queda en BD pero ya NO se usa para PIN (el PIN ahora es por perfil).
- `watch_history.profile_id` y `anime_lists.profile_id` (NULL = pre-perfiles).

**Reglas clave:**
- Límite por plan: **Free 2 perfiles, Premium 3** (cliente vía `getMaxProfiles(isPremium)`; trigger DB tope a 3). Solo se auto-crea el perfil principal; los demás cupos quedan vacíos hasta que el dueño los cree manualmente.
- **Auto-creación**: si la cuenta tiene 0 perfiles, `ProfileGate` crea únicamente el perfil principal por defecto (usa `username` o email) para que el usuario lo termine de personalizar.
- **Selector forzado tras login**: `AuthContext` borra `zet:active-profile-id` y todos `zet:pin-ok:*` en cada evento `SIGNED_IN`. Así, entrar desde otro dispositivo o tras logout siempre muestra "¿Quién está viendo?" (Netflix-style).
- PIN es **por perfil**, no de cuenta. Cualquier perfil (free o premium) puede activarlo al crearlo o editarlo.
- `sessionStorage["zet:pin-ok:{profileId}"]` evita re-pedirlo en la misma sesión.
- Avatares secundarios vienen de **AniList** (`Character.image.large`). Solo el perfil principal/dueño puede subir foto desde el dispositivo; perfiles secundarios solo eligen personajes AniList.
- Dispositivos: Free 2, Premium 3. Tercer dispositivo free → `DeviceLimitModal` con CTA premium (no desconecta otros).
- Solo el perfil principal ve sesiones/dispositivos y gestión global de perfiles. Los perfiles secundarios pueden editar únicamente su propio nombre/avatar AniList/PIN; no pueden crear, borrar ni gestionar otros perfiles.
- Selector estilo Netflix a pantalla completa con vignette, animaciones `animate-fade-in` escalonadas, hover scale + glow primary, badge `KeyRound` en perfiles con PIN. Layout `pt-10 md:pt-16` con `my-auto` interno (sin hueco vacío arriba).
- `signOut` limpia `zet:active-profile-id` + todos los `zet:pin-ok:*`.

## Aislamiento de datos por perfil
**Regla de query:** todo acceso a `watch_history` y `anime_lists` filtra por scope:
```ts
const scoped = (q) => profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
```

Wireado en: `src/lib/anime-lists.ts`, `src/pages/AnimeDetail.tsx`, `src/pages/MyLists.tsx`, `src/pages/Watch.tsx`, `src/pages/RecentlyWatched.tsx`, `src/pages/Profile.tsx`, `src/lib/export-history-pdf.ts`.

## Flujo de selección
`ProfileGate` orquesta:
1. Bloqueo dispositivos → `DeviceLimitModal`.
2. Selector tras login si no hay activo. `onPick`: si el perfil tiene `pin_enabled`, se pasa a `PinPrompt` (muestra avatar + nombre + 4 inputs). Si no, se selecciona directo.
3. Si la sesión expira (recarga) y el perfil activo tiene PIN, también pide PIN.
4. Si no hay perfiles, abre `ProfileSelector manageMode` que automáticamente muestra el editor.

## Archivos clave
- Libs: `src/lib/account-profiles.ts` (CRUD + PIN por perfil + helpers session), `src/lib/anilist-avatars.ts` (galería AniList), `src/lib/devices.ts`, `src/lib/device-id.ts`.
- Contexto: `src/contexts/ProfilesContext.tsx`.
- UI: `ProfileSelector` (rediseño Netflix con editor inline `ProfileEditor` que incluye galería AniList con búsqueda + toggle PIN), `PinPrompt` (acepta `profile: AccountProfile`, muestra avatar y shake en error), `DeviceLimitModal`, `ProfileManagementSection`, `ProfileGate`.
- `account-pin.ts` queda como helper legacy de cuenta — ya no se usa en la UI.
