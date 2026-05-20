## Cambios solicitados

### A. Texto del botón Exportar PDF (rápido)
- En `Profile.tsx`, cambiar badge "TRIO" → "Premium" y subtítulo "Disponible en plan TRIO" → "Disponible al subir de plan".
- Eliminar toda mención pública a SOLO/DUO/TRIO en mensajes de gating (usar "Función premium" / "Disponible al actualizar tu plan"). Los nombres reales siguen existiendo en admin.

### B. Nuevos permisos dinámicos en `premium_plans`
Migración: agregar columnas booleanas con default `false`:
- `multi_status_selection` (selección múltiple de estados de anime)
- `custom_avatar_upload` (subir foto personal)
- `vip_support` (soporte priorizado premium)

Free recibe los 3 en `false`. Owner siempre `true`. Editor del admin (`PremiumConfigEditor`) muestra los 3 toggles por plan.

Extender `PlanPermissions` + `plan-permissions.ts` + `usePlanPermissions` para exponer estos 3 flags.

### C. Selección múltiple de estados de anime
- En `anime-lists.ts` / página `MyLists.tsx` / botones de cambio de estado en `AnimeDetail.tsx`:
  - Si `multi_status_selection === false` → el usuario sólo puede tener el anime en máximo **2 listas distintas**. Al intentar añadir una 3ª, mostrar modal "Función premium — actualiza tu plan para guardar en más listas".
  - Si `true` → sin límite.
- Aplicar la verificación en la función que inserta en `user_anime_lists` (o equivalente) leyendo el conteo actual.

### D. Avatar personalizado solo premium
- En `Profile.tsx` (sección avatar): el botón cámara (overlay del círculo) sólo se renderiza si `permissions.custom_avatar_upload === true`.
- Si `false`: ocultar el botón cámara y mostrar tooltip/hint "Disponible al actualizar tu plan". Free sigue usando avatares de personajes predefinidos (ya existe `anilist-avatars`).
- También aplicar gate al endpoint de subida en cliente (early-return con toast).

### E. Sistema de soporte (Premium VIP + Free)

**DB nueva tabla `support_tickets`:**
```
id uuid pk
user_id uuid
plan_slug text          -- snapshot del plan al crear
priority text           -- 'vip' | 'standard'
subject text null
message text not null
image_url text null     -- solo VIP
status text default 'pending'  -- pending|in_progress|answered|solved|closed
admin_response text null
admin_id uuid null
created_at, updated_at, responded_at
```

RLS:
- user puede ver/insert solo los propios.
- admins/owner: select/update todos.
- Trigger updated_at.

**Bucket storage** `support-attachments` (privado, signed URL al admin).

**Cliente:**
- `src/lib/support.ts` — `createTicket`, `listMyTickets`, `listAllTicketsAdmin`, `updateTicketStatus`, `respondTicket`.
- Validación de texto: regex permitiendo letras (incluye acentos/ñ), números, espacios y símbolos comunes `# $ % & / ( ) = ? ¡ ! * + - _ , . : ; @ " ' ¿`. Rechazar emojis y unicode raro.
- Premium VIP: hasta 1000 chars + 1 imagen (validar + comprimir con `image-compress.ts`).
- Free: hasta 200 chars, sin imagen, gating por permiso `vip_support === false` → cae a flujo free, queda en cola con prioridad `standard`.

**UI usuario** (sección dentro de `Profile.tsx` "Soporte"):
- Formulario con contador de caracteres dinámico según permiso.
- Lista de tickets propios con estado y respuesta tipo burbujas WhatsApp.
- Toast/alert cuando cambia el estado a `answered`/`solved` (suscripción Realtime a `support_tickets` filtrada por `user_id`).

**Admin** (`Admin.tsx` → sección Reportes dividida en 2 sub-tabs):
- Tab 1: "Anime/Video" (lo actual de `BrokenReports`).
- Tab 2: "Soporte" → componente nuevo `SupportTicketsAdmin.tsx`:
  - Lista en bloques WhatsApp-style, separa VIP arriba y Free debajo.
  - Cada ticket: user info, plan, fecha, estado, imagen, mensaje.
  - Acciones: responder, cambiar estado (pending/in_progress/answered/solved/closed), priorizar.
- También un panel resumido al pie del perfil del admin (visible sólo si tiene rol admin/owner) — link a la tab completa.

### F. Notificaciones al usuario
- Realtime subscription en `Layout.tsx` (sólo si user logueado) que escucha cambios en `support_tickets` del propio user.
- Al detectar `status` cambiado a `answered`/`solved`/`in_progress`, dispara `toast` con icono y CTA "Ver respuesta" que abre la sección soporte de Profile.

### G. Memory update
- Guardar memory `mem://features/soporte-tickets` y actualizar `mem://index.md` con la nueva regla de "no mencionar nombres de planes públicamente en gating".

---

## Detalles técnicos resumidos

```
DB:
  premium_plans + multi_status_selection / custom_avatar_upload / vip_support
  support_tickets (nueva tabla + RLS + realtime)
  storage bucket support-attachments

Client nuevo:
  src/lib/support.ts
  src/components/support/SupportForm.tsx
  src/components/support/MyTicketsList.tsx
  src/components/admin/SupportTicketsAdmin.tsx
  src/hooks/useSupportNotifications.ts

Client editado:
  src/lib/plan-permissions.ts         (3 flags nuevos)
  src/components/admin/PremiumConfigEditor.tsx  (3 toggles)
  src/pages/Profile.tsx               (badge PDF, gate avatar, tab soporte)
  src/pages/MyLists.tsx + lib/anime-lists.ts  (gate 2 estados)
  src/pages/AnimeDetail.tsx           (gate al cambiar estado)
  src/pages/Admin.tsx                 (split reportes)
  src/components/Layout.tsx           (notif realtime)
```

---

## Orden de implementación
1. Migración DB (3 columnas + tabla `support_tickets` + RLS + bucket + realtime).
2. Plan permissions + admin toggles.
3. Texto del botón PDF y gating sin nombres de plan.
4. Gate multi-status en listas.
5. Gate cámara en avatar.
6. Sistema soporte (lib + UI usuario + UI admin + realtime).
7. Memory.

¿Apruebas para empezar?
