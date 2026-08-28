// Edge function que resuelve el stream de un episodio SIN exponer la URL madre
// al navegador. El cliente envía solo { action, anilistId, lang, ep }.
// El servidor consulta la URL madre vía service_role y llama a la VPS scraper.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// URL de respaldo si `app_settings.vps_extractor_url` no existe todavía.
const FALLBACK_VPS_BASE = "https://a24785-7a2f.xs1.onjrnm.link";
const ZET_BASE = "https://zetapi-api.samvelzeta.workers.dev/api";

// Caché corta de la URL de la VPS para no consultar app_settings en cada request.
let vpsUrlCache: { at: number; value: string } | null = null;
const VPS_URL_TTL_MS = 60_000;

async function getSeekeBotUrl(supabase: ReturnType<typeof createClient>): Promise<string> {
  if (vpsUrlCache && Date.now() - vpsUrlCache.at < VPS_URL_TTL_MS) return vpsUrlCache.value;
  let base = FALLBACK_VPS_BASE;
  try {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "vps_extractor_url")
      .maybeSingle();
    const raw = (data as any)?.value;
    if (typeof raw === "string" && raw.trim().startsWith("http")) base = raw.trim();
  } catch { /* usa el fallback */ }
  const clean = base.replace(/\/+$/, "");
  const full = clean.endsWith("/extraer") ? clean : `${clean}/extraer`;
  vpsUrlCache = { at: Date.now(), value: full };
  return full;
}

// 🧠 Caché en memoria del edge (viva mientras la instancia esté caliente).
// TTL corto para no servir enlaces caducados pero absorbiendo picos de tráfico.
// Los animes EN EMISIÓN cambian seguido → TTL corto.
// Los FINALIZADOS casi nunca cambian → TTL largo (menos consultas a la DB).
const EPISODE_TTL_RELEASING_MS = 150_000;      // 2.5 min
const EPISODE_TTL_FINISHED_MS = 6 * 60 * 60_000; // 6 h
const LATEST_TTL_RELEASING_MS = 60_000;        // 1 min
const LATEST_TTL_FINISHED_MS = 60 * 60_000;    // 1 h
type CacheEntry<T> = { at: number; value: T };
const episodeCache = new Map<string, CacheEntry<any>>();
const latestCache = new Map<string, CacheEntry<number | null>>();

// Caché del estado de emisión (para decidir el TTL) — 1 h.
const statusCache = new Map<number, CacheEntry<string>>();
async function getAiringStatus(
  supabase: ReturnType<typeof createClient>,
  anilistId: number,
): Promise<string> {
  const hit = statusCache.get(anilistId);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.value;
  let status = "UNKNOWN";
  try {
    const { data } = await supabase
      .from("anime_download_tracker")
      .select("airing_status")
      .eq("anilist_id", anilistId)
      .maybeSingle();
    if ((data as any)?.airing_status) status = String((data as any).airing_status).toUpperCase();
  } catch { /* usa UNKNOWN */ }
  statusCache.set(anilistId, { at: Date.now(), value: status });
  return status;
}
function isReleasing(status: string) {
  return status === "RELEASING" || status === "NOT_YET_RELEASED" || status === "UNKNOWN";
}

/** Anula el caché caliente de un anime (lo llama el admin al editar/borrar enlaces). */
function invalidateAnime(anilistId: number) {
  for (const k of [...episodeCache.keys()]) {
    if (k.startsWith(`${anilistId}|`)) episodeCache.delete(k);
  }
  for (const k of [...latestCache.keys()]) {
    if (k.startsWith(`${anilistId}|`)) latestCache.delete(k);
  }
  statusCache.delete(anilistId);
}

function cacheGet<T>(m: Map<string, CacheEntry<T>>, key: string, ttl: number): T | null {
  const hit = m.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttl) { m.delete(key); return null; }
  return hit.value;
}
function cacheSet<T>(m: Map<string, CacheEntry<T>>, key: string, value: T) {
  m.set(key, { at: Date.now(), value });
  if (m.size > 500) {
    // LRU-ish: borra las 100 más antiguas
    const entries = [...m.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, 100);
    for (const [k] of entries) m.delete(k);
  }
}

type SeekeSub = { lang?: string; language?: string; srclang?: string; url?: string; src?: string; label?: string };
type SeekeResp = {
  ok?: boolean;
  embed?: string;
  episode?: number;
  cached?: boolean;
  subtitles?: SeekeSub[];
  latest_episode?: number;
  calidades?: Record<string, string>;
  qualities?: Record<string, string>;
  error?: string;
};

function normalizeUrl(url: string): string {
  const clean = url.trim();
  try {
    const u = new URL(clean);
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/\/\d+\/?$/, "");
    return u.toString();
  } catch {
    return clean.replace(/\/\d+\/?$/, "");
  }
}

function normalizeSubs(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s: SeekeSub) => ({
      lang: String(s?.lang || s?.language || s?.srclang || "es"),
      url: String(s?.url || s?.src || ""),
      label: s?.label ? String(s.label) : undefined,
    }))
    .filter((s) => !!s.url);
}

function normalizeQualities(raw: unknown) {
  if (!raw || typeof raw !== "object") return [];
  const out: { label: string; url: string }[] = [];
  for (const [label, url] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof url === "string" && url) out.push({ label, url });
  }
  return out;
}

async function resolveMasterUrl(
  supabase: ReturnType<typeof createClient>,
  anilistId: number,
  lang: string,
  ep: number,
  variant: number = 1,
): Promise<{ url: string; sourceEp: number } | null> {
  // 1) Bloques (rangos de episodios con URLs madre distintas)
  const { data: blocks } = await supabase
    .from("video_cache_blocks")
    .select("seeke_base_url, episode_from, episode_to, source_episode_offset, inverse_mode, block_index")
    .eq("anilist_id", anilistId)
    .eq("lang", lang)
    .order("block_index", { ascending: true });

  if (Array.isArray(blocks) && blocks.length > 0) {
    const matches = (blocks as any[]).filter(
      (b: any) => ep >= b.episode_from && ep <= b.episode_to,
    );
    if (matches.length === 0) return null;
    const idx = Math.max(1, variant) - 1;
    const match = matches[idx] || matches[matches.length - 1];
    const offset = Number(match.source_episode_offset || 0);
    const relative = ep - match.episode_from + 1;
    return { url: match.seeke_base_url, sourceEp: relative + offset };
  }

  // 2) URL madre única (episode=0 con sources.seeke[0])
  const { data: base } = await supabase
    .from("video_cache")
    .select("sources")
    .eq("anilist_id", anilistId)
    .eq("lang", lang)
    .eq("episode", 0)
    .order("updated_at", { ascending: false })
    .limit(1);

  const seekeArr = (base?.[0] as any)?.sources?.seeke;
  if (Array.isArray(seekeArr) && seekeArr[0]) {
    return { url: String(seekeArr[0]), sourceEp: ep };
  }
  return null;
}

/**
 * Resuelve una URL madre para consultar `latest_episode` de todo el anime.
 * Prioriza episode=0 (URL madre canónica) y, si no hay, usa el ÚLTIMO bloque
 * definido — su latest se traduce a episodio absoluto acotado al rango del bloque.
 * Nunca devuelve null si existe cualquier configuración Seeke para el idioma.
 */
async function resolveMasterForLatest(
  supabase: ReturnType<typeof createClient>,
  anilistId: number,
  lang: string,
): Promise<{ url: string; sourceEp: number; translate?: (vpsLatest: number) => number } | null> {
  // 1) URL madre canónica (episode=0)
  const { data: base } = await supabase
    .from("video_cache")
    .select("sources")
    .eq("anilist_id", anilistId)
    .eq("lang", lang)
    .eq("episode", 0)
    .order("updated_at", { ascending: false })
    .limit(1);
  const seekeArr = (base?.[0] as any)?.sources?.seeke;
  if (Array.isArray(seekeArr) && seekeArr[0]) {
    return { url: String(seekeArr[0]), sourceEp: 1 };
  }

  // 2) Último bloque — traducir latest relativo a episodio absoluto.
  const { data: blocks } = await supabase
    .from("video_cache_blocks")
    .select("seeke_base_url, episode_from, episode_to, source_episode_offset")
    .eq("anilist_id", anilistId)
    .eq("lang", lang)
    .order("block_index", { ascending: false })
    .limit(1);
  const last = (blocks as any[])?.[0];
  if (last?.seeke_base_url) {
    const offset = Number(last.source_episode_offset || 0);
    const relTop = last.episode_to - last.episode_from + 1;
    // Pedimos al VPS el episodio TOP del bloque para maximizar el latest_episode.
    const probeSourceEp = Math.max(1, relTop + offset);
    return {
      url: String(last.seeke_base_url),
      sourceEp: probeSourceEp,
      translate: (vpsLatest: number) => {
        // absolute = vpsLatest + episode_from - 1 - offset, acotado por episode_to.
        const abs = vpsLatest + Number(last.episode_from) - 1 - offset;
        return Math.min(Number(last.episode_to), Math.max(0, abs));
      },
    };
  }
  return null;
}

async function callScraper(
  supabase: ReturnType<typeof createClient>,
  masterUrl: string,
  ep: number,
  latestOnly = false,
): Promise<SeekeResp | null> {
  const normalizedMaster = normalizeUrl(masterUrl);
  try {
    const seekeBotUrl = await getSeekeBotUrl(supabase);
    const r = await fetch(seekeBotUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        url: normalizedMaster,
        ep,
        no_cache: true,
        force: true,
        cache_bust: Date.now(),
        ...(latestOnly ? { latest_only: true } : {}),
      }),
    });
    if (r.ok) {
      const direct = (await r.json()) as SeekeResp;
      if (direct?.ok && (latestOnly || direct.embed)) return direct;
    }
  } catch {
    // La VPS puede cambiar de dominio o tener una caída DNS. Continuar por el
    // proxy protegido para que una caída del host directo no rompa el player.
  }

  try {
    const apiKey = Deno.env.get("ZET_API_KEY");
    const params = new URLSearchParams({
      url: normalizedMaster,
      ep: String(ep),
      no_cache: "1",
      force: "1",
      _: String(Date.now()),
    });
    if (latestOnly) params.set("latest_only", "1");

    const headers: Record<string, string> = { Accept: "application/json" };
    if (apiKey) {
      headers["x-api-key"] = apiKey;
      headers["x-access-token"] = apiKey;
      headers.apikey = apiKey;
      headers.token = apiKey;
      headers.Authorization = `Bearer ${apiKey}`;
    }

    const fallback = await fetch(`${ZET_BASE}/anime/episode-seeke?${params.toString()}`, {
      method: "GET",
      headers,
    });
    if (!fallback.ok) return null;
    return (await fallback.json()) as SeekeResp;
  } catch {
    return null;
  }
}

/**
 * Fallback por slug: cuando no hay URL madre Seeke, busca el slug del anime
 * en la tabla `slugs` y llama a zetapi Cloudflare `/anime/:slug/episode/:ep?lang=`.
 */
async function resolveSlugFallback(
  supabase: ReturnType<typeof createClient>,
  anilistId: number,
  ep: number,
  lang: string,
): Promise<any | null> {
  const { data: slugRow } = await supabase
    .from("slugs")
    .select("slug, manual_slug")
    .eq("anilist_id", anilistId)
    .maybeSingle();
  const slug = (slugRow as any)?.manual_slug || (slugRow as any)?.slug;
  if (!slug) return null;

  const apiKey = Deno.env.get("ZET_API_KEY");
  const headers: Record<string, string> = { Accept: "application/json" };
  if (apiKey) {
    headers["x-api-key"] = apiKey;
    headers["x-access-token"] = apiKey;
    headers.apikey = apiKey;
    headers.token = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  try {
    const url = `${ZET_BASE}/anime/${encodeURIComponent(slug)}/episode/${ep}?lang=${lang}`;
    const res = await fetch(url, { method: "GET", headers });
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success || !json?.data) return null;
    const d = json.data;
    const servers = Array.isArray(d.servers) ? d.servers : [];
    const bestEmbed = servers.find((s: any) => s?.embed)?.embed || null;
    if (!bestEmbed) return null;
    return {
      ok: true,
      embed: bestEmbed,
      episode: d.number || ep,
      cached: false,
      subtitles: Array.isArray(d.subtitles) ? d.subtitles.map((s: any) => ({
        lang: s?.lang || "es",
        url: s?.url || "",
        label: s?.label,
      })).filter((s: any) => s.url) : [],
      latest_episode: null,
      qualities: [],
      servers,
      source: "slug",
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  const action = String(body?.action || "episode");
  const anilistId = Number(body?.anilistId);
  const lang = String(body?.lang || "sub");
  const ep = Number(body?.ep || 1);
  const variant = Math.max(1, Number(body?.variant || 1));

  if (!Number.isFinite(anilistId) || anilistId <= 0) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_anilist_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  try {
    const cacheKey = `${anilistId}|${lang}|${ep}|v${variant}`;

    // Purga manual desde el admin cuando se edita/borra un enlace Seeke o slug.
    if (action === "invalidate") {
      invalidateAnime(anilistId);
      return new Response(JSON.stringify({ ok: true, invalidated: anilistId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const releasing = isReleasing(await getAiringStatus(supabase, anilistId));
    const episodeTtl = releasing ? EPISODE_TTL_RELEASING_MS : EPISODE_TTL_FINISHED_MS;
    const latestTtl = releasing ? LATEST_TTL_RELEASING_MS : LATEST_TTL_FINISHED_MS;

    if (action === "latest") {
      const latestKey = `${anilistId}|${lang}`;
      const cachedLatest = cacheGet(latestCache, latestKey, latestTtl);
      if (cachedLatest !== null) {
        return new Response(
          JSON.stringify({ ok: true, latest_episode: cachedLatest, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const master = await resolveMasterForLatest(supabase, anilistId, lang);
      if (!master) {
        return new Response(JSON.stringify({ ok: false, error: "no_master_configured" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      let data = await callScraper(supabase, master.url, Math.max(1, master.sourceEp), true);
      if (!data || !Number.isFinite(Number(data?.latest_episode))) {
        data = await callScraper(supabase, master.url, Math.max(1, master.sourceEp), false);
      }
      const latestRaw = Number(data?.latest_episode);
      const translated = Number.isFinite(latestRaw)
        ? (master.translate ? master.translate(latestRaw) : latestRaw)
        : null;
      if (translated !== null) cacheSet(latestCache, latestKey, translated);
      return new Response(
        JSON.stringify({ ok: true, latest_episode: translated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // action === "episode" — servir de caché caliente si disponible
    const cachedEp = cacheGet(episodeCache, cacheKey, EPISODE_TTL_MS);
    if (cachedEp) {
      return new Response(
        JSON.stringify({ ...cachedEp, cached: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const master = await resolveMasterUrl(supabase, anilistId, lang, ep, variant);
    if (!master) {
      // Fallback por slug: si no hay Seeke configurado pero el anime tiene slug,
      // llamamos a zetapi de Cloudflare directamente para resolver los servidores.
      const slugData = await resolveSlugFallback(supabase, anilistId, ep, lang);
      if (slugData) {
        cacheSet(episodeCache, cacheKey, slugData);
        return new Response(JSON.stringify(slugData), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: false, error: "no_master_configured" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await callScraper(supabase, master.url, master.sourceEp, false);
    if (!data?.ok || !data?.embed) {
      return new Response(
        JSON.stringify({ ok: false, error: data?.error || "resolve_failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const payload = {
      ok: true,
      embed: String(data.embed),
      episode: Number.isFinite(Number(data.episode)) ? Number(data.episode) : ep,
      cached: false,
      subtitles: normalizeSubs(data.subtitles),
      latest_episode: Number.isFinite(Number(data.latest_episode)) ? Number(data.latest_episode) : null,
      qualities: normalizeQualities(data.calidades ?? data.qualities),
    };
    cacheSet(episodeCache, cacheKey, payload);
    // NO cacheamos latest_episode desde la rama "episode" porque cuando el
    // anime usa bloques ese número es RELATIVO al bloque, no absoluto. La
    // rama "latest" tiene la lógica correcta de traducción.
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
