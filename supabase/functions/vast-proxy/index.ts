// VAST XML proxy — bypasses CORS for ad networks (ExoClick, MagSrv, etc).
// Public (no JWT required) — only proxies HTTPS GETs to known ad domains.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, apikey, x-client-info",
};

const ALLOWED_HOSTS = [
  "magsrv.com", "s.magsrv.com", "exoclick.com", "syndication.exoclick.com",
  "trafficjunky.net", "trafficjunky.com",
  "adsterra.com", "highperformanceformat.com", "displaycontentprovider.com",
  "googleads.g.doubleclick.net", "googlesyndication.com",
];

function isAllowed(url: URL): boolean {
  const h = url.hostname.toLowerCase();
  return ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  try {
    const u = new URL(req.url);
    const target = u.searchParams.get("url");
    if (!target) return new Response("missing url", { status: 400, headers: CORS });
    let parsed: URL;
    try { parsed = new URL(target); } catch { return new Response("bad url", { status: 400, headers: CORS }); }
    if (parsed.protocol !== "https:") return new Response("https only", { status: 400, headers: CORS });
    if (!isAllowed(parsed)) return new Response("host not allowed", { status: 403, headers: CORS });

    const r = await fetch(parsed.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ZetAnimes/1.0)",
        "Accept": "application/xml, text/xml, */*",
      },
    });
    const body = await r.text();
    return new Response(body, {
      status: r.status,
      headers: {
        ...CORS,
        "Content-Type": r.headers.get("content-type") || "application/xml",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return new Response(`proxy error: ${(e as Error).message}`, { status: 502, headers: CORS });
  }
});
