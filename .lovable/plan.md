# Refactor del sistema Premium + Streams + PDF

## Problema actual
- El sistema mezcla **sesiones de login** con **streams simultáneos** y con **perfiles**.
- Hoy bloquea el login completo cuando se supera el "cupo de dispositivos", cuando en realidad solo debería bloquear **reproducciones activas**.
- Los planes están medio cableados (límites fijos free=2 / premium=5) y no se reflejan dinámicamente desde el admin.
- El botón Exportar PDF solo aparece para premium y se descarga igual en APK que en navegador.

## Objetivo
1. **Separar 3 conceptos** en backend y UI:
   - `auth_sessions` → login en N dispositivos, **sin límite por plan**.
   - `streaming_sessions` → solo cuando hay un reproductor activo. Limitado por plan.
   - `account_profiles` → perfiles dentro de la cuenta. Limitado por plan.
2. **Planes 100% dinámicos** editables desde admin, con permisos booleanos que toda la app consulta.
3. **Tres planes oficiales** (SOLO / DUO / TRIO) con los precios y permisos solicitados.
4. **Exportar PDF** visible siempre, pero solo ejecutable si el plan lo permite. En APK WebView → copiar enlace temporal al portapapeles para abrir en navegador externo.

---

## 1. Cambios de base de datos

### 1.1 Ampliar `premium_plans`
Agregar columnas de permisos (todas con default seguro):

```
slug              text unique           -- 'solo' | 'duo' | 'trio' (estable)
price_monthly     numeric
price_annual      numeric
max_streams       int  default 1
max_profiles      int  default 1
quality_max       text default 'hd'     -- 'hd' | 'fhd' | '4k'
ads_free          bool default false
priority_servers  bool default false
downloads_allowed bool default false
pdf_export        bool default false
premium_badge     bool default false
```

Seed inicial:
- **SOLO** $2.99 / $14.99 — 1 stream, 2 perfiles (no simultáneos), HD, ads_free.
- **DUO** $4.99 / $23.99 — 2 streams, 2 perfiles, FHD, ads_free, priority_servers.
- **TRIO** $7.99 / $34.99 — 3 streams, 3 perfiles, 4K, ads_free, priority_servers, downloads_allowed, **pdf_export**, premium_badge.

### 1.2 Nueva tabla `streaming_sessions`
```
id uuid pk
user_id uuid
device_id text
profile_id uuid null
anime_id int
episode_number int
started_at timestamptz default now()
last_heartbeat_at timestamptz default now()
ended_at timestamptz null
```
- "Activa" = `ended_at IS NULL AND last_heartbeat_at > now() - 90s`.
- Índices por `(user_id) WHERE ended_at IS NULL`.

Funciones RPC:
- `start_stream(_device_id, _profile_id, _anime_id, _episode)` → cierra streams del mismo device, valida límite del plan, inserta nuevo. Retorna `{ allowed, current, limit }`.
- `heartbeat_stream(_session_id)` → update `last_heartbeat_at`.
- `end_stream(_session_id)`.
- `cleanup_stale_streams()` (se llama al inicio de `start_stream`): marca `ended_at` a los que llevan >90s sin heartbeat.

### 1.3 Quitar la lógica de "device limit" del login
- Mantener `device_sessions` solo para mostrar "Mis dispositivos" y permitir cerrar sesión remota.
- **Eliminar el bloqueo** que cierra sesión al pasar el cupo. Login es siempre libre.

### 1.4 Actualizar `enforce_max_profiles`
Leer `max_profiles` desde el plan activo del usuario (vía `premium_memberships` → `premium_plans.slug`) en vez del cap fijo 2/4.

---

## 2. Capa de cliente

### 2.1 Hook `usePlanPermissions()`
Devuelve el plan resuelto del usuario (`SOLO`/`DUO`/`TRIO`/`FREE`) con todos los booleanos y límites. Se consume en:
- VastAdOverlay → `ads_free` reemplaza al check actual de `isPremium`.
- ProfileGate / ProfileSelector → `max_profiles`.
- VideoPlayer (start/heartbeat/end de streams) → `max_streams`.
- PDF export → `pdf_export`.
- Quality selector y "Priority servers" UI.

### 2.2 Streaming guard en el player
- Al montar `AnimePlayer`: llamar `start_stream`. Si `allowed === false` mostrar modal **"Estás viendo en otro dispositivo"** con la lista y opción "Detener allá y ver aquí".
- Heartbeat cada 30s mientras el video esté reproduciéndose.
- `end_stream` en unmount / pausa larga / cambio de página.

### 2.3 Quitar `DeviceLimitModal` del flujo de login
Solo se usará desde "Mis dispositivos" como herramienta informativa.

---

## 3. Admin panel (`PremiumConfigEditor`)
Editor por plan con campos:
- name, slug, price_monthly, price_annual, badge, accent_color, sort_order, enabled
- max_streams, max_profiles, quality_max
- toggles: ads_free, priority_servers, downloads_allowed, pdf_export, premium_badge
- features[] (texto libre que ya existe)

Guardar = update en `premium_plans`. Todo el frontend lo lee en caliente vía `usePlanPermissions`.

---

## 4. Export PDF (botón siempre visible)

### 4.1 Botón visible en todos los planes
En `Profile.tsx` (o donde esté) mostrar **Exportar PDF** siempre. Al click:
- Si `pdf_export === false` → modal "Mejora a TRIO para exportar tu historial en PDF" con CTA premium.
- Si `pdf_export === true` → continuar.

### 4.2 Detección de entorno
Usar `isWebView()` de `src/lib/webview.ts` (ya existe):
- **PC / navegador normal / PWA**: descarga directa con el flujo actual (`export-history-pdf.ts`).
- **APK WebView**: 
  1. Subir el PDF generado a Storage (`premium-assets/pdf-exports/{user}/{timestamp}.pdf`) con expiración corta, o generar un signed URL de 10 min.
  2. Copiar la URL al portapapeles con `navigator.clipboard.writeText`.
  3. Toast: *"Enlace copiado al portapapeles. Ábrelo en tu navegador externo para descargar tu PDF."*
  4. Mostrar también un modal con el enlace clickeable y botón "Copiar de nuevo".

---

## Detalles técnicos (resumen)

```text
DB:
  premium_plans (+ permisos)
  streaming_sessions (nueva)
  RPC: start_stream / heartbeat_stream / end_stream / cleanup_stale_streams
  enforce_max_profiles → lee max_profiles del plan

Client:
  src/lib/plan-permissions.ts    (resolver)
  src/hooks/usePlanPermissions.ts
  src/lib/streaming-sessions.ts  (start/heartbeat/end)
  src/components/video/AnimePlayer.tsx  (integrar guard)
  src/components/video/StreamLimitModal.tsx  (nuevo)
  src/components/profiles/ProfileGate.tsx    (quitar device-limit bloqueante)
  src/components/profiles/DeviceLimitModal.tsx  (solo informativo)
  src/components/admin/PremiumConfigEditor.tsx (nuevos campos)
  src/lib/export-history-pdf.ts  (rama webview→clipboard)
  src/lib/devices.ts             (sin límite, solo registro)
```

---

## Orden de implementación
1. Migración: ampliar `premium_plans`, crear `streaming_sessions` + RPCs, actualizar `enforce_max_profiles`, seed/upsert de los 3 planes.
2. Backend client: `plan-permissions.ts`, `streaming-sessions.ts`.
3. Quitar bloqueo de login por dispositivos.
4. Integrar guard de streams en el player + modal.
5. Conectar VastAdOverlay, perfiles y demás features a `usePlanPermissions`.
6. Rediseñar admin (`PremiumConfigEditor`) para los nuevos campos.
7. PDF: botón siempre visible + gate + flujo APK con clipboard.

¿Apruebas el plan para empezar con la migración?
