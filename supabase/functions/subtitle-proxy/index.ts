// VPS-style subtitle proxy: descarga el .srt server-side con headers correctos
// y devuelve el contenido como texto plano. Evita CORS y referer-block del navegador.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

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

    if (!url || !/^https?:\/\//i.test(url)) {
      return new Response(JSON.stringify({ ok: false, error: "invalid url" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
