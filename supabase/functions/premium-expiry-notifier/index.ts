// Cron diario: avisa a los apoyadores 5 días antes de que su plan expire.
// - Solo notifica a USUARIOS regulares (excluye owner/admin).
// - Envía UNA notificación resumen al owner con el total enviado.
// - Dispara auto-expiración y limpieza de BD.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const KOFI_URL = "https://ko-fi.com/zetanimes";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // IDs de roles privilegiados — NO deben recibir la notificación masiva.
    const { data: staffRows } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["owner", "admin"]);
    const staffIds = new Set((staffRows || []).map((r: any) => r.user_id));
    const ownerIds = (staffRows || [])
      .filter((r: any) => r.role === "owner")
      .map((r: any) => r.user_id);

    // 1. Candidatos: apoyo activo, expira entre 4 y 5 días, sin aviso previo
    const { data: soon } = await supabase
      .from("profiles")
      .select("user_id, plan_type, subscription_expires_at, expiry_notice_sent_at, username")
      .eq("subscription_status", "active")
      .not("subscription_expires_at", "is", null)
      .gte("subscription_expires_at", new Date(Date.now() + 4 * 86400000).toISOString())
      .lte("subscription_expires_at", new Date(Date.now() + 5 * 86400000).toISOString())
      .is("expiry_notice_sent_at", null);

    let notified = 0;
    const sentUsernames: string[] = [];
    for (const p of soon || []) {
      // Saltar staff: el owner/admin no debe recibir el aviso de expiración.
      if (staffIds.has(p.user_id)) continue;

      const expires = new Date(p.subscription_expires_at!);
      const days = Math.max(1, Math.ceil((expires.getTime() - Date.now()) / 86400000));
      await supabase.from("notifications").insert({
        title: "Tu apoyo está por finalizar 💛",
        message: `En ${days} días termina tu apoyo a ZetAnime. Pulsa aquí para renovar tu aporte y seguir disfrutando de los beneficios. ¡Gracias por apoyar la comunidad!`,
        type: "warning",
        target_user_id: p.user_id,
        link: KOFI_URL,
        active: true,
      });
      await supabase
        .from("profiles")
        .update({ expiry_notice_sent_at: new Date().toISOString() })
        .eq("user_id", p.user_id);
      notified++;
      if (p.username) sentUsernames.push(p.username);
    }

    // 1b. Resumen al owner (UNA sola notificación, no una por usuario).
    if (notified > 0 && ownerIds.length > 0) {
      const preview = sentUsernames.slice(0, 5).join(", ");
      const extra = sentUsernames.length > 5 ? ` y ${sentUsernames.length - 5} más` : "";
      for (const ownerId of ownerIds) {
        await supabase.from("notifications").insert({
          title: "Avisos de expiración enviados ✅",
          message: `Se notificó a ${notified} apoyador${notified === 1 ? "" : "es"} que su plan vence en 5 días${preview ? `: ${preview}${extra}` : ""}.`,
          type: "success",
          target_user_id: ownerId,
          active: true,
        });
      }
    }

    // 2. Auto-expirar
    const { data: expired } = await supabase.rpc("auto_expire_subscriptions");

    // 3. Cleanup BD
    const { data: cleanup } = await supabase.rpc("cleanup_old_data");

    return new Response(
      JSON.stringify({ ok: true, notified, expired, cleanup }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
