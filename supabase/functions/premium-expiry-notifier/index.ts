// Cron diario: avisa a los apoyadores 5 días antes de que su plan expire.
// También dispara auto-expiración y limpieza de BD.
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

    // 1. Aviso 5 días antes (entre 4 y 5 días restantes, una sola vez)
    const { data: soon } = await supabase
      .from("profiles")
      .select("user_id, plan_type, subscription_expires_at, expiry_notice_sent_at")
      .eq("subscription_status", "active")
      .not("subscription_expires_at", "is", null)
      .gte("subscription_expires_at", new Date(Date.now() + 4 * 86400000).toISOString())
      .lte("subscription_expires_at", new Date(Date.now() + 5 * 86400000).toISOString())
      .is("expiry_notice_sent_at", null);

    let notified = 0;
    for (const p of soon || []) {
      const expires = new Date(p.subscription_expires_at!);
      const days = Math.max(1, Math.ceil((expires.getTime() - Date.now()) / 86400000));
      await supabase.from("notifications").insert({
        title: "Tu apoyo está por finalizar 💛",
        message: `En ${days} días termina tu apoyo a ZetAnime. Si quieres seguir disfrutando de los beneficios, considera renovar tu aporte. ¡Gracias por apoyar la comunidad!`,
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
