---
name: Sistema de perfiles, dispositivos y PIN
description: Hasta 5 perfiles con datos aislados por profile_id (historial/listas/stats/PDF), 2/5 dispositivos, PIN cuenta premium
type: feature
---

## Sistema completo de perfiles + dispositivos + PIN (Fase 3 completa)

**Tablas:**
- `account_profiles` (máx 5 vía trigger `enforce_max_profiles`): name, avatar_url, accent_color, font_family, is_default. RLS por user_id.
- `device_sessions` (UNIQUE user_id+device_id): device_name, platform, last_active_at. "Activo" = últimos 7 días.
- `account_settings`: pin_enabled + pin_hash (SHA-256 de `zet:{userId}:{pin}`).
- `watch_history.profile_id` y `anime_lists.profile_id` añadidas (NULL = pre-perfiles / cuenta sin perfil activo).

**Reglas:**
- Perfiles arrancan vacíos. Premium NO se hereda al perfil, es de cuenta.
- Selector aparece tras login (`ProfileGate`) + botón en HeaderBar.
- Dispositivos: Free 2, Premium 5. Tercer dispositivo free → `DeviceLimitModal` con CTA premium (no desconecta otros).
- PIN: solo premium. `sessionStorage["zet:pin-session-ok"]` evita re-pedir. signOut limpia `zet:active-profile-id` y la flag de PIN.

## Aislamiento de datos por perfil
**Regla de query:** todo acceso a `watch_history` y `anime_lists` filtra por scope:
```ts
const scoped = (q) => profileId ? q.eq("profile_id", profileId) : q.is("profile_id", null);
```

Wireado en:
- `src/lib/anime-lists.ts` → `toggleAnimeListSmart({ profileId, ... })` inserta y borra con scope.
- `src/pages/AnimeDetail.tsx` → query `["anime-list", animeId, userId, profileId]`.
- `src/pages/MyLists.tsx` → carga listas filtradas por perfil.
- `src/pages/Watch.tsx` → `getHistoryBase` incluye `profile_id`; `ensureHistoryEntry` filtra por scope.
- `src/pages/RecentlyWatched.tsx` → load + clearHistory por scope.
- `src/pages/Profile.tsx` → stats (lists/episodes/hours) por scope.
- `src/lib/export-history-pdf.ts` → recibe `profileId` opcional y exporta solo datos del perfil activo.

**Archivos clave:**
- Libs: `src/lib/device-id.ts`, `src/lib/devices.ts`, `src/lib/account-pin.ts`, `src/lib/account-profiles.ts`
- Contexto: `src/contexts/ProfilesContext.tsx` (envuelto dentro de AuthProvider)
- UI: `ProfileSelector`, `PinPrompt`, `DeviceLimitModal`, `ProfileManagementSection`, `ProfileGate` (orquesta)
- Integración: App.tsx envuelve con ProfilesProvider + ProfileGate; HeaderBar muestra avatar del perfil activo + switcher.
