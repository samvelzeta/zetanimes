// Devuelve la URL real del APK ensamblada y descifrada.
// No expone el origen en el HTML; el cliente la usa de inmediato para iniciar la descarga.
// Acepta llamadas anónimas (verify_jwt = false por defecto).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function aesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APK_ENCRYPTION_KEY") || "";
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
}

async function decryptUrl(encrypted: string): Promise<string> {
  if (!encrypted.startsWith("enc:")) return encrypted;
  const body = encrypted.slice(4);
  const [ivB64, ctB64] = body.split(".");
  if (!ivB64 || !ctB64) throw new Error("Formato inválido");
  const iv = b64Decode(ivB64);
  const ct = b64Decode(ctB64);
  const key = await aesKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return dec.decode(plain);
}

// Fragmenta una URL en N partes y las codifica en base64 con nombres opacos.
// El cliente recibe { p, q, r, s, ... } y reconstruye con join. El nombre de
// los campos no menciona "url" ni "github" para no delatar la fuente.
function shred(url: string, parts = 4): Record<string, string> {
  const len = url.length;
  const chunk = Math.ceil(len / parts);
  const labels = ["p", "q", "r", "s", "t", "u"];
  const out: Record<string, string> = {};
  for (let i = 0; i < parts; i++) {
    const piece = url.slice(i * chunk, (i + 1) * chunk);
    out[labels[i] || `x${i}`] = btoa(unescape(encodeURIComponent(piece)));
  }
  out["_n"] = String(parts);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "apk_download_url_enc")
      .maybeSingle();

    if (error || !data?.value) {
      return new Response(JSON.stringify({ error: "no-apk" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const realUrl = await decryptUrl(data.value as string);
    // Devolvemos la URL fragmentada y codificada para que en DevTools no
    // sea trivial reconstruir el origen leyendo la respuesta.
    const payload = shred(realUrl, 4);

    return new Response(JSON.stringify(payload), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
