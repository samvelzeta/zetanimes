// Manifiesto de cosméticos (marcos + banners de admin) cacheado de forma
// permanente en Cloudflare KV. Ruta de lectura: memoria → KV → base de datos.
// Invalidación explícita: POST { action: "invalidate" } tras cualquier CRUD admin.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const CF_ACCOUNT = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const CF_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "";
const CF_KV_NS = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") ?? "";
const KV_ON = Boolean(CF_ACCOUNT && CF_TOKEN && CF_KV_NS);
const KV_BASE = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT}/storage/kv/namespaces/${CF_KV_NS}`;
const KV_KEY = "manifest:cosmetics:v1";
const MEM_TTL = 300_000; // 5 min por instancia

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

async function kvPut(key: string, value: unknown) {
  if (!KV_ON) return;
  try {
    const form = new FormData();
    form.append("value", JSON.stringify(value));
    form.append("metadata", "{}");
    // Sin expiration_ttl → permanente hasta invalidación explícita.
    await fetch(`${KV_BASE}/values/${encodeURIComponent(key)}`, {
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

async function buildFromDB() {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const [frames, banners] = await Promise.all([
    supabase
      .from("admin_frames")
      .select("id,name,image_url,shape,rarity,requirement_type,requirement_value,position")
      .eq("active", true)
      .order("position", { ascending: true }),
    supabase
      .from("admin_banners")
      .select("id,name,image_url,requirement_type,requirement_value,rarity,position")
      .eq("active", true)
      .order("position", { ascending: true }),
  ]);
  return {
    frames: frames.data ?? [],
    banners: banners.data ?? [],
    generated_at: new Date().toISOString(),
  };
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
    const fresh = await buildFromDB();
    await kvPut(KV_KEY, fresh);
    mem = { at: Date.now(), data: fresh };
    return json({ ok: true, refreshed: true });
  }

  if (mem && Date.now() - mem.at < MEM_TTL) {
    return json({ ...(mem.data as object), source: "memory" });
  }

  const cached = await kvGet<Record<string, unknown>>(KV_KEY);
  if (cached) {
    mem = { at: Date.now(), data: cached };
    return json({ ...cached, source: "kv" });
  }

  try {
    const fresh = await buildFromDB();
    mem = { at: Date.now(), data: fresh };
    await kvPut(KV_KEY, fresh);
    return json({ ...fresh, source: "db" });
  } catch (e) {
    return json({ frames: [], banners: [], error: (e as Error).message }, 200);
  }
});
