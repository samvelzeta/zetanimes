// Genera un token efímero firmado (HMAC) para descargar el APK.
// El token expira en 5 minutos y se valida en apk-download.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APK_ENCRYPTION_KEY") || "";
  return crypto.subtle.importKey(
    "raw",
    enc.encode(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const exp = Math.floor(Date.now() / 1000) + 5 * 60; // 5 min
    const nonce = b64url(crypto.getRandomValues(new Uint8Array(8)));
    const payload = JSON.stringify({ exp, n: nonce });
    const payloadB64 = b64url(enc.encode(payload));

    const key = await hmacKey();
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payloadB64));
    const sigB64 = b64url(sig);

    const token = `${payloadB64}.${sigB64}`;

    return new Response(JSON.stringify({ token, exp }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
