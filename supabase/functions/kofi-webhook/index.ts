// Webhook que recibe pagos confirmados desde Make.com (origen: Ko-fi).
// Activa/actualiza la suscripción del usuario en profiles según el email.
//
// Payload esperado (JSON):
//   {
//     "email": "user@correo.com",        // requerido
//     "plan_type": "basico"|"solo"|"duo",// requerido si status=active
//     "status": "active"|"inactive"|"expired", // default: active
//     "days": 365                        // opcional, default 365
//   }
//
// Header requerido:
//   x-webhook-secret: <KOFI_WEBHOOK_SECRET>

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PLANS = new Set(["basico", "solo", "duo"]);
const ALLOWED_STATUS = new Set(["active", "inactive", "expired"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const secret = Deno.env.get("KOFI_WEBHOOK_SECRET");
  if (!secret) {
    return new Response(JSON.stringify({ error: "webhook secret not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.headers.get("x-webhook-secret") !== secret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const planType = String(body?.plan_type || "").trim().toLowerCase();
  const status = (String(body?.status || "active").trim().toLowerCase()) as
    | "active"
    | "inactive"
    | "expired";
  const days = Number(body?.days) > 0 ? Number(body.days) : 365;

  if (!email) {
    return new Response(JSON.stringify({ error: "email required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!ALLOWED_STATUS.has(status)) {
    return new Response(JSON.stringify({ error: "invalid status" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (status === "active" && !ALLOWED_PLANS.has(planType)) {
    return new Response(
      JSON.stringify({ error: "plan_type must be basico|solo|duo when status=active" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Localizar usuario por email en auth.users
  let userId: string | null = null;
  // Paginar la primera página (suficiente para la mayoría de instancias)
  const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    return new Response(JSON.stringify({ error: "auth lookup failed", detail: listErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const found = usersPage.users.find(
    (u) => (u.email || "").toLowerCase() === email
  );
  if (found) userId = found.id;

  if (!userId) {
    return new Response(
      JSON.stringify({ error: "user not found for that email", email }),
      { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // 2. Actualizar suscripción
  const expiresAt =
    status === "active" ? new Date(Date.now() + days * 86_400_000).toISOString() : null;

  const { error: upErr } = await admin
    .from("profiles")
    .update({
      subscription_status: status,
      plan_type: status === "active" ? planType : null,
      subscription_email: email,
      subscription_expires_at: expiresAt,
      subscription_updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (upErr) {
    return new Response(JSON.stringify({ error: "update failed", detail: upErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      user_id: userId,
      email,
      status,
      plan_type: status === "active" ? planType : null,
      expires_at: expiresAt,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
