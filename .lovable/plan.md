
## Reemplazo total del sistema premium

### 1. Base de datos (migración)

**Añadir a `profiles`:**
- `subscription_status text default 'inactive'` (valores: `active` | `inactive` | `expired`)
- `plan_type text` (`basico` | `solo` | `duo`)
- `subscription_email text` (email que usó en Ko-fi, puede diferir del email auth)
- `subscription_expires_at timestamptz`
- `subscription_updated_at timestamptz default now()`

**Borrar (drop):**
- Tablas: `premium_memberships`, `premium_requests`, `premium_plans`, `premium_settings`, `admin_payment_info`
- Bucket: `premium-proofs`
- Funciones: `get_user_plan_slug`, `get_user_max_streams`, `get_user_max_profiles` → reescritas para leer de `profiles`

**Reescribir helpers SQL:** las 3 funciones anteriores ahora derivan de `profiles.subscription_status='active'` + `plan_type`.

**RLS nueva en profiles:** política `service_role bypass` ya existe por defecto en Supabase; añado política explícita para que `service_role` haga UPSERT sin restricción (no la necesita pero la dejo documentada).

### 2. Edge Function nueva: `kofi-webhook`

- Recibe POST de Make.com con `{ email, plan_type, status, expires_at }`.
- Verifica un secret `KOFI_WEBHOOK_SECRET` en header `x-webhook-secret`.
- Busca usuario por `email` en `auth.users` (vía service role).
- UPSERT en `profiles` los 5 campos de suscripción.
- `verify_jwt = false` en config.toml.

### 3. Frontend — pricing

**Eliminar/limpiar:**
- `PremiumScreen.tsx`, `PremiumConfigEditor.tsx`, `ExpiryAlert.tsx`, `premium-config.ts`, todo el flujo de comprobantes.
- Sección "Revisión Premium" en `Admin.tsx`.
- Hooks/lib: `plan-permissions.ts` y `usePlanPermissions.ts` se simplifican a leer `subscription_status` y mapear a permisos hardcodeados por `plan_type`.

**Nueva página `Premium.tsx`** (reemplaza ruta actual): 3 cards
- Básico $5/año — botón → `window.open('https://ko-fi.com/zetanimes', '_blank')`
- Solo $8/año — idem
- Dúo $10/año — idem

### 4. Perfil — badge VIP

En `Profile.tsx`, si `profile.subscription_status === 'active'`:
- Badge "VIP" + texto del `plan_type` ("Básico" / "Solo" / "Dúo").

### 5. Permisos por plan (hardcoded)

```
basico → ads_free, max_streams=1, max_profiles=2
solo   → ads_free, max_streams=2, max_profiles=3, downloads, pdf
duo    → ads_free, max_streams=3, max_profiles=5, downloads, pdf, vip_support, custom_avatar
inactive/null → free
```

### 6. Datos técnicos para Make.com (al final, en chat)

- Project Ref, Project URL, anon key (públicos, ya los tienes).
- **Service role key:** te indico paso a paso cómo copiarla desde el panel — NO la pego en el chat por seguridad.
- Nombre tabla (`profiles`) + columnas exactas.
- URL del webhook + ejemplo de payload + secret a configurar.

### Riesgos importantes
- **Se pierden todas las membresías activas actuales** y los comprobantes guardados. Los usuarios premium actuales quedan en `inactive` hasta que pasen por Ko-fi de nuevo, o los reactives manualmente.
- El sistema de revisión manual desaparece por completo.
- Si Make.com falla, no hay UI de respaldo para activar premium (puedes hacerlo a mano con SQL).

¿Apruebas para ejecutar?
