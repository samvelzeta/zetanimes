---
name: Sistema de perfiles, dispositivos y PIN
description: Hasta 5 perfiles por cuenta, límite 2 free / 5 premium dispositivos, PIN cuenta premium
type: feature
---

## Sistema completo de perfiles + dispositivos + PIN (Fase 3)

**Tablas:**
- `account_profiles` (máx 5 vía trigger): name, avatar_url, accent_color, font_family, is_default. RLS por user_id.
- `device_sessions` (UNIQUE user_id+device_id): device_name, platform, last_active_at. Considera "activo" últimos 7 días.
- `account_settings`: pin_enabled + pin_hash (SHA-256 de `zet:{userId}:{pin}`).
- `watch_history.profile_id` y `anime_lists.profile_id` añadidas (NULL = pre-perfiles).

**Reglas:**
- Perfiles: arrancan vacíos; cada cuenta crea desde cero. Premium NO se hereda al perfil, es de cuenta.
- Selector aparece tras login (gate) + botón en HeaderBar (Users icon, sm:flex).
- Dispositivos: Free 2, Premium 5. Tercer dispositivo free → `DeviceLimitModal` con CTA premium. NO desconecta otros (bloquea el nuevo).
- PIN: Solo premium. Si activo, se pide al iniciar (sessionStorage `zet:pin-session-ok`). Hash en cliente con SHA-256.
- signOut limpia `zet:active-profile-id` y `zet:pin-session-ok`.

**Archivos clave:**
- Libs: `src/lib/device-id.ts`, `src/lib/devices.ts`, `src/lib/account-pin.ts`, `src/lib/account-profiles.ts`
- Contexto: `src/contexts/ProfilesContext.tsx` (envuelve dentro de AuthProvider)
- UI: `ProfileSelector`, `PinPrompt`, `DeviceLimitModal`, `ProfileManagementSection`, `ProfileGate` (orquesta)
- Integración: App.tsx envuelve con ProfilesProvider + ProfileGate; HeaderBar muestra avatar del perfil activo + botón switcher; Profile.tsx incluye ProfileManagementSection.
