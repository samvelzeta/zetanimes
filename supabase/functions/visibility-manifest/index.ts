import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

// Manifiesto de visibilidad (aprobados / ocultos / adultos / seeke / reserva / estados).
// Ruta de lectura: memoria del edge → Cloudflare KV → base de datos.
// Invalidación: POST { action: "invalidate" } (lo llama el admin tras cualquier CRUD).

const CF_ACCOUNT = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "";
const CF_KV_NS = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") ?? "";
const KV_ON = Boolean(CF_ACCOUNT && CF_TOKEN && CF_KV_NS);
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_KV_NS}`;
const KV_KEY = "manifest:visibility:v1";
const KV_TTL = 900; // 15 min
const MEM_TTL = 120_000; // 2 min por instancia

let mem: { at: number; data: unknown } | null = null;

async function kvGet<T>(key: string): Promise<T | null> {
  if (!KV_ON) return null;
  try {
    const res = await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function kvPut(key: string, value: unknown, ttl: number) {
  if (!KV_ON) return;
  try {
    const form = new FormData();
    form.append("value", JSON.stringify(value));
    form.append("metadata", "{}");
    await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}?expiration_ttl=${ttl}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
      body: form,
    });
  } catch {
    /* noop */
  }
}

async function kvDelete(key: string) {
  if (!KV_ON) return;
  try {
    await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${CF_TOKEN}` },
    });
  } catch {
    /* noop */
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let action = "get";
  if (req.method === "POST") {
    try {
      const body = await req.json();
      if (typeof body?.action === "string") action = body.action;
    } catch {
      /* body opcional */
    }
  }

  if (action === "invalidate") {
    mem = null;
    await kvDelete(KV_KEY);
    return json({ ok: true, invalidated: true });
  }

  if (mem && Date.now() - mem.at < MEM_TTL) {
    return json({ ok: true, source: "memory", manifest: mem.data });
  }

  const cached = await kvGet<unknown>(KV_KEY);
  if (cached) {
    mem = { at: Date.now(), data: cached };
    return json({ ok: true, source: "kv", manifest: cached });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await supabase.rpc("get_visibility_manifest");
  if (error) return json({ ok: false, error: error.message }, 500);

  mem = { at: Date.now(), data };
  await kvPut(KV_KEY, data, KV_TTL);
  return json({ ok: true, source: "db", manifest: data });
});
