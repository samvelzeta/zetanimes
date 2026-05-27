// Webhook que recibe pagos confirmados desde Ko-fi (vía Make.com o directo).
// Activa/actualiza la suscripción del usuario en la tabla `profiles` según el email.
//
// Formatos aceptados:
//  1) Ko-fi nativo: { type: "Shop Order"|"Subscription"|"Donation", email, amount, tier_name, ... }
//  2) Simple:       { email, plan_type: "basico"|"solo"|"duo", status?, days? }
//
// Mapeo monto USD → plan: 5 → basico, 8 → solo, 10 → duo
// Header de auth: x-bridge-secret (preferido) o x-webhook-secret
//
// IMPORTANTE: el email se busca en auth.users (no hay columna email en profiles),
// y la actualización se hace en profiles.user_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret, x-bridge-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_PLANS = new Set(["basico", "solo", "duo"]);
const ALLOWED_STATUS = new Set(["active", "inactive", "expired"]);

function planFromAmount(amount: number): string | null {
  if (!isFinite(amount) || amount <= 0) return null;
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
  if (!secret) {
    console.error("[kofi-webhook] KOFI_WEBHOOK_SECRET no configurado");
    return json({ error: "webhook secret not configured" }, 500);
  }

  const provided =
    req.headers.get("x-bridge-secret") ?? req.headers.get("x-webhook-secret");
  if (provided !== secret) {
    console.warn("[kofi-webhook] Secret inválido o ausente");
    return json({ error: "unauthorized" }, 401);
  }

  // ---- Parse body (acepta JSON directo o Ko-fi clásico con form-data "data") ----
  let body: any;
  const raw = await req.text();
  console.log("[kofi-webhook] RAW BODY:", raw);

  try {
    body = JSON.parse(raw);
  } catch {
    // Ko-fi clásico envía application/x-www-form-urlencoded con campo "data" = JSON string
    try {
      const params = new URLSearchParams(raw);
      const dataField = params.get("data");
      if (dataField) body = JSON.parse(dataField);
      else throw new Error("no data field");
    } catch (e) {
      console.error("[kofi-webhook] JSON inválido:", e);
      return json({ error: "invalid json", raw_preview: raw.slice(0, 200) }, 400);
    }
  }

  console.log("[kofi-webhook] PARSED BODY:", JSON.stringify(body));

  // ---- Detectar formato ----
  const isKofiNative =
    typeof body?.type === "string" ||
    typeof body?.kofi_transaction_id === "string" ||
    body?.is_subscription_payment !== undefined ||
    body?.shop_items !== undefined;

  let email = String(body?.email || "").trim().toLowerCase();
  let planType = "";
  let status: "active" | "inactive" | "expired" = "active";
  let days = 365;

  if (isKofiNative) {
    const amountNum = Number(body?.amount ?? 0);
    const tier = body?.tier_name ?? body?.tier ?? null;
    planType = planFromTier(tier) ?? planFromAmount(amountNum) ?? "";

    const t = String(body?.type || "").toLowerCase();
    console.log(`[kofi-webhook] type=${t} amount=${amountNum} tier=${tier} plan=${planType} email=${email}`);

    // Aceptamos Shop Order, Subscription y Donation (si mapea a plan)
    const allowedTypes = ["shop order", "subscription", "donation", ""];
    if (!allowedTypes.includes(t)) {
      console.log(`[kofi-webhook] ignorado: type=${t} no soportado`);
      return json({ ok: true, ignored: true, reason: `type=${t}` });
    }
    if (!planType) {
      console.log(`[kofi-webhook] ignorado: amount=${body?.amount} no mapea a plan`);
      return json({
        ok: true,
        ignored: true,
        reason: `amount ${body?.amount} no mapea a ningún plan (5/8/10)`,
      });
    }
    status = "active";
  } else {
    planType = String(body?.plan_type || "").trim().toLowerCase();
    status = (String(body?.status || "active").trim().toLowerCase()) as typeof status;
    if (Number(body?.days) > 0) days = Number(body.days);
  }

  if (!email) {
    console.error("[kofi-webhook] email vacío en payload");
    return json({ error: "email required", received: body }, 400);
  }
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

  // ---- Buscar user_id por email en auth.users (paginado) ----
  let userId: string | null = null;
  let totalScanned = 0;
  for (let page = 1; page <= 20 && !userId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) {
      console.error("[kofi-webhook] error listUsers:", error.message);
      return json({ error: "auth lookup failed", detail: error.message }, 500);
    }
    totalScanned += data.users.length;
    const found = data.users.find((u) => (u.email || "").toLowerCase() === email);
    if (found) {
      userId = found.id;
      console.log(`[kofi-webhook] usuario encontrado user_id=${userId} email=${email}`);
    }
    if (data.users.length < 1000) break;
  }

  if (!userId) {
    console.warn(`[kofi-webhook] USUARIO NO ENCONTRADO email=${email} (escaneados=${totalScanned})`);
    return json(
      {
        error: "user not found for that email",
        email,
        hint: "El usuario debe haberse registrado previamente en ZetAnimes con ese email.",
        scanned_users: totalScanned,
      },
      404
    );
  }

  // ---- Actualizar suscripción en profiles ----
  const expiresAt =
    status === "active"
      ? new Date(Date.now() + days * 86_400_000).toISOString()
      : null;

  const updatePayload = {
    subscription_status: status,
    plan_type: status === "active" ? planType : null,
    subscription_email: email,
    subscription_expires_at: expiresAt,
    subscription_updated_at: new Date().toISOString(),
  };

  console.log("[kofi-webhook] UPDATE profiles SET", JSON.stringify(updatePayload), "WHERE user_id =", userId);

  const { data: updated, error: upErr } = await admin
    .from("profiles")
    .update(updatePayload)
    .eq("user_id", userId)
    .select("user_id, subscription_status, plan_type, subscription_expires_at");

  if (upErr) {
    console.error("[kofi-webhook] UPDATE falló:", upErr.message);
    return json({ error: "update failed", detail: upErr.message, user_id: userId }, 500);
  }

  if (!updated || updated.length === 0) {
    console.error(`[kofi-webhook] UPDATE no afectó filas. ¿Falta row en profiles para user_id=${userId}?`);
    return json(
      {
        error: "no profile row updated",
        user_id: userId,
        hint: "No existe fila en `profiles` para este user_id. Verifica el trigger handle_new_user.",
      },
      500
    );
  }

  console.log("[kofi-webhook] ✅ ÉXITO:", JSON.stringify(updated[0]));

  return json({
    ok: true,
    user_id: userId,
    email,
    status,
    plan_type: status === "active" ? planType : null,
    expires_at: expiresAt,
    source: isKofiNative ? "kofi-native" : "simple",
    updated: updated[0],
  });
});
