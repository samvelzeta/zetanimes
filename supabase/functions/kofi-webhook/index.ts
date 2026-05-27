// Webhook que recibe pagos confirmados desde Ko-fi (directo o vía Make.com).
// Activa/actualiza la suscripción del usuario en la tabla `profiles` según el email.
//
// === ACEPTA DOS FORMATOS ===
//
// 1) Formato nativo Ko-fi (lo que Ko-fi envía a Make):
//    {
//      "type": "Subscription",
//      "email": "jo.example@example.com",
//      "amount": "8.00",
//      "tier_name": "Solo",                  // opcional
//      "is_subscription_payment": true,
//      "is_first_subscription_payment": true,
//      ...otros campos Ko-fi (se ignoran)
//    }
//
// 2) Formato simplificado (si prefieres mapear en Make antes):
//    {
//      "email": "user@correo.com",
//      "plan_type": "basico" | "solo" | "duo",
//      "status": "active" | "inactive" | "expired",   // default: active
//      "days": 365                                    // opcional, default 365
//    }
//
// === MAPEO DE PLAN POR MONTO (USD) ===
//   5.00 → basico  | 8.00 → solo  | 10.00 → duo
//   El tier_name también se acepta (Basico/Solo/Duo, case-insensitive).
//
// === HEADERS ===
//   x-bridge-secret: <KOFI_WEBHOOK_SECRET>   (preferido — el que tienes en Make)
//   x-webhook-secret: <KOFI_WEBHOOK_SECRET>  (alternativo, retrocompatible)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-bridge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PLANS = new Set(["basico", "solo", "duo"]);
const ALLOWED_STATUS = new Set(["active", "inactive", "expired"]);

// Mapa monto USD → plan
function planFromAmount(amount: number): string | null {
  if (amount >= 10) return "duo";
  if (amount >= 8) return "solo";
  if (amount >= 5) return "basico";
  return null;
}

function planFromTier(tier: string | null | undefined): string | null {
  if (!tier) return null;
  const t = tier.trim().toLowerCase();
  if (t.includes("duo") || t.includes("dúo")) return "duo";
  if (t.includes("solo")) return "solo";
  if (t.includes("basic") || t.includes("básic")) return "basico";
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const secret = Deno.env.get("KOFI_WEBHOOK_SECRET");
  if (!secret) return json({ error: "webhook secret not configured" }, 500);

  const provided =
    req.headers.get("x-bridge-secret") ?? req.headers.get("x-webhook-secret");
  if (provided !== secret) return json({ error: "unauthorized" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  // ---- Detectar formato ----
  const isKofiNative =
    typeof body?.type === "string" ||
    typeof body?.kofi_transaction_id === "string" ||
    body?.is_subscription_payment !== undefined;

  let email = "";
  let planType = "";
  let status: "active" | "inactive" | "expired" = "active";
  let days = 365;

  if (isKofiNative) {
    email = String(body?.email || "").trim().toLowerCase();
    const amountNum = Number(body?.amount ?? 0);
    planType =
      planFromTier(body?.tier_name) ??
      planFromAmount(amountNum) ??
      "";

    // Ko-fi: solo procesamos suscripciones o donaciones que mapean a un plan
    const t = String(body?.type || "").toLowerCase();
    if (t && t !== "subscription" && t !== "donation" && t !== "shop order") {
      return json({ ok: true, ignored: true, reason: `type=${t}` });
    }
    if (!planType) {
      return json({
        ok: true,
        ignored: true,
        reason: `amount ${body?.amount} no mapea a ningún plan (5/8/10)`,
      });
    }
    status = "active";
  } else {
    email = String(body?.email || "").trim().toLowerCase();
    planType = String(body?.plan_type || "").trim().toLowerCase();
    status = (String(body?.status || "active").trim().toLowerCase()) as typeof status;
    if (Number(body?.days) > 0) days = Number(body.days);
  }

  if (!email) return json({ error: "email required" }, 400);
  if (!ALLOWED_STATUS.has(status)) return json({ error: "invalid status" }, 400);
  if (status === "active" && !ALLOWED_PLANS.has(planType)) {
    return json(
      { error: "plan_type must be basico|solo|duo when status=active", got: planType },
      400
    );
  }

  // ---- Cliente admin ----
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- Buscar usuario por email (paginado, hasta ~10k usuarios) ----
  let userId: string | null = null;
  for (let page = 1; page <= 10 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      return json({ error: "auth lookup failed", detail: error.message }, 500);
    }
    const found = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (found) userId = found.id;
    if (data.users.length < 1000) break;
  }

  if (!userId) {
    return json({ error: "user not found for that email", email }, 404);
  }

  // ---- Actualizar suscripción ----
  const expiresAt =
    status === "active"
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;

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
    return json({ error: "update failed", detail: upErr.message }, 500);
  }

  return json({
    ok: true,
    user_id: userId,
    email,
    status,
    plan_type: status === "active" ? planType : null,
    expires_at: expiresAt,
    source: isKofiNative ? "kofi-native" : "simple",
  });
});
