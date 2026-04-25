// Valida un token firmado, descifra la URL real del APK, y hace stream
// del binario al cliente para que NUNCA se vea el origen (ej. GitHub).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const enc = new TextEncoder();
const dec = new TextDecoder();

function b64urlDecode(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

async function hmacKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APK_ENCRYPTION_KEY") || "";
  return crypto.subtle.importKey(
    "raw",
    enc.encode(raw),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
}

async function aesKey(): Promise<CryptoKey> {
  const raw = Deno.env.get("APK_ENCRYPTION_KEY") || "";
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  return crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "decrypt",
  ]);
}

async function verifyToken(token: string): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payloadB64, sigB64] = parts;
  const key = await hmacKey();
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    toArrayBuffer(b64urlDecode(sigB64)),
    enc.encode(payloadB64),
  );
  if (!ok) return false;
  try {
    const payload = JSON.parse(dec.decode(b64urlDecode(payloadB64)));
    if (typeof payload.exp !== "number") return false;
    if (Math.floor(Date.now() / 1000) > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

async function decryptUrl(encrypted: string): Promise<string> {
  if (!encrypted.startsWith("enc:")) return encrypted; // legacy fallback (no debería pasar)
  const body = encrypted.slice(4);
  const [ivB64, ctB64] = body.split(".");
  if (!ivB64 || !ctB64) throw new Error("Formato inválido");
  const iv = b64Decode(ivB64);
  const ct = b64Decode(ctB64);
  const key = await aesKey();
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(ct));
  return dec.decode(plain);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("t") || "";
    if (!token) {
      return new Response("Missing token", { status: 400, headers: corsHeaders });
    }

    const valid = await verifyToken(token);
    if (!valid) {
      return new Response("Token inválido o expirado", {
        status: 401,
        headers: corsHeaders,
      });
    }

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
      return new Response("APK no configurado", { status: 404, headers: corsHeaders });
    }

    const realUrl = await decryptUrl(data.value as string);

    // Stream desde el origen real (oculto). Seguimos redirects.
    const upstream = await fetch(realUrl, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return new Response("No se pudo obtener el APK", {
        status: 502,
        headers: corsHeaders,
      });
    }

    const headers = new Headers(corsHeaders);
    headers.set("Content-Type", "application/vnd.android.package-archive");
    headers.set("Content-Disposition", 'attachment; filename="zetanime.apk"');
    headers.set("Cache-Control", "no-store");
    const len = upstream.headers.get("Content-Length");
    if (len) headers.set("Content-Length", len);

    return new Response(upstream.body, { status: 200, headers });
  } catch (e) {
    return new Response(`Error: ${errorMessage(e)}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
});
