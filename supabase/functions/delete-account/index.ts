// Borrado definitivo de cuenta solicitado por el propio usuario.
// Requiere JWT válido + confirmación escrita del nombre del perfil.
// Elimina: filas de base de datos, caché en Cloudflare KV y la cuenta de auth.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CF_ACCOUNT = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "";
const CF_KV_NS = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") ?? "";
const KV_ON = Boolean(CF_ACCOUNT && CF_TOKEN && CF_KV_NS);
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_KV_NS}`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function norm(v: unknown) {
  return String(v ?? "").trim().toLowerCase();
}

async function purgeKvForUser(userId: string) {
  if (!KV_ON) return 0;
  let deleted = 0;
  for (const prefix of [`user:${userId}`, `cosmetics:${userId}`, `profile:${userId}`]) {
    try {
      const res = await fetch(`${KV_BASE}/keys?prefix=${encodeURIComponent(prefix)}&limit=1000`, {
        headers: { Authorization: `Bearer ${CF_TOKEN}` },
      });
      const body = await res.json();
      const keys: string[] = (body?.result || []).map((k: any) => k.name);
      for (const key of keys) {
        await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${CF_TOKEN}` },
        });
        deleted += 1;
      }
    } catch {
      /* noop */
    }
  }
  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  const user = userRes?.user;
  if (userErr || !user) return json({ error: "unauthorized" }, 401);

  let confirmName = "";
  try {
    const body = await req.json();
    confirmName = typeof body?.confirmName === "string" ? body.confirmName : "";
  } catch {
    /* noop */
  }
  if (!confirmName.trim()) return json({ error: "confirm_name_required" }, 400);

  // Nombres aceptados: perfiles de la cuenta + display_name + username
  const [{ data: profile }, { data: accProfiles }] = await Promise.all([
    admin.from("profiles").select("display_name,username").eq("user_id", user.id).maybeSingle(),
    admin.from("account_profiles").select("name").eq("user_id", user.id),
  ]);
  const valid = new Set<string>();
  if (profile?.display_name) valid.add(norm(profile.display_name));
  if (profile?.username) valid.add(norm(profile.username));
  (accProfiles || []).forEach((p: any) => p?.name && valid.add(norm(p.name)));
  if (!valid.has(norm(confirmName))) return json({ error: "name_mismatch" }, 400);

  // No permitir que staff se borre a sí mismo por accidente
  const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
  if ((roles || []).some((r: any) => r.role === "owner" || r.role === "admin")) {
    return json({ error: "staff_cannot_self_delete" }, 403);
  }

  // 1) Filas sin cascada automática hacia auth.users
  const tables = [
    "account_profiles",
    "device_sessions",
    "streaming_sessions",
    "support_tickets",
    "broken_link_reporters",
    "profile_stats",
    "watch_history",
    "anime_lists",
    "anime_likes",
    "notification_dismissals",
    "user_cosmetics",
    "user_gacha_inventory",
    "user_gacha_tokens",
    "user_missions",
    "user_achievements",
    "user_xp",
    "gacha_pity",
    "gacha_pulls",
    "user_roles",
    "profiles",
  ];
  const errors: string[] = [];
  for (const t of tables) {
    const { error } = await admin.from(t).delete().eq("user_id", user.id);
    if (error) errors.push(`${t}: ${error.message}`);
  }
  await admin.from("notifications").delete().eq("target_user_id", user.id);

  // 2) Caché en Cloudflare KV
  const kvDeleted = await purgeKvForUser(user.id);

  // 3) Cuenta de autenticación
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return json({ ok: false, error: delErr.message, errors }, 500);

  return json({ ok: true, kv_deleted: kvDeleted, errors });
});
