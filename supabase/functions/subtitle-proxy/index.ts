// VPS-style subtitle proxy: descarga el .srt server-side con headers correctos
// y devuelve el contenido como texto plano. Evita CORS y referer-block del navegador.
//
// Endurecido contra SSRF: sólo http(s), puertos estándar, sin hosts privados/loopback
// y sólo extensiones de subtítulos conocidas. Los redirects se validan manualmente.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const MAX_REDIRECTS = 3;
const SUBTITLE_EXT = /\.(srt|vtt|ass|ssa|sub)(\?|#|$)/i;

const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^0\./,
  /^169\.254\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.(1[89])\./,
  /^192\.0\.0\./,
  /^192\.0\.2\./,
  /^224\./,
  /^240\./,
  /^255\.255\.255\.255$/,
];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (host === "metadata.google.internal") return true;
  // IPv6 loopback / link-local / unique-local
  if (host === "::1" || host === "::" ) return true;
  if (/^(fe80|fc|fd)/i.test(host)) return true;
  // IPv4-mapped IPv6
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  const v4 = mapped ? mapped[1] : host;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    if (PRIVATE_V4.some((re) => re.test(v4))) return true;
  }
  return false;
}

function validateUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.port && !["80", "443", "8080", "8443"].includes(u.port)) return null;
  if (u.username || u.password) return null;
  if (isBlockedHost(u.hostname)) return null;
  if (!SUBTITLE_EXT.test(u.pathname + u.search)) return null;
  return u;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let url = "";
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      url = String(body?.url || "");
    } else {
      const u = new URL(req.url);
      url = u.searchParams.get("url") || "";
    }

    const target = validateUrl(url);
    if (!target) {
      return new Response(JSON.stringify({ ok: false, error: "invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    url = target.toString();


    const referer = (() => {
      try { const u = new URL(url); return `${u.protocol}//${u.host}/`; } catch { return url; }
    })();

    const upstream = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "Accept": "application/x-subrip,text/vtt,text/plain,*/*",
        "Referer": referer,
      },
    });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ ok: false, error: `upstream ${upstream.status}` }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = await upstream.text();
    return new Response(JSON.stringify({ ok: true, content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, max-age=3600" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
