import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

const ACCOUNT = Deno.env.get("R2_ACCOUNT_ID") ?? "";
const TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "";
const NS = Deno.env.get("CLOUDFLARE_KV_NAMESPACE_ID") ?? "";
const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/storage/kv/namespaces/${NS}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const out: Record<string, unknown> = {
    has_account: Boolean(ACCOUNT),
    has_token: Boolean(TOKEN),
    has_namespace: Boolean(NS),
  };

  if (ACCOUNT && TOKEN && NS) {
    try {
      // 1) Lectura de claves (prueba de permisos + conexión)
      const list = await fetch(`${BASE}/keys?limit=100`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      const listJson = await list.json();
      out.list_status = list.status;
      out.list_ok = listJson?.success ?? false;
      out.errors = listJson?.errors ?? [];
      const keys: string[] = (listJson?.result || []).map((k: any) => k.name);
      out.sample_keys = keys.slice(0, 25);
      out.key_count_sample = keys.length;
      out.prefixes = Array.from(new Set(keys.map((k) => k.split(":")[0]))).slice(0, 20);

      // 2) Escritura + lectura + borrado de una clave de prueba
      const testKey = "healthcheck:zetanimes";
      const form = new FormData();
      form.append("value", JSON.stringify({ at: new Date().toISOString() }));
      form.append("metadata", "{}");
      const put = await fetch(`${BASE}/values/${testKey}?expiration_ttl=60`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${TOKEN}` },
        body: form,
      });
      out.write_status = put.status;
      const get = await fetch(`${BASE}/values/${testKey}`, {
        headers: { Authorization: `Bearer ${TOKEN}` },
      });
      out.read_status = get.status;
      out.read_value = await get.text();
    } catch (err) {
      out.error = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
