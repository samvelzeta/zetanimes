// Sincroniza `auto_latest_episodes` consultando la VPS Seeke cada 24h.
// - Toma los animes aprobados que tienen video_cache_blocks con seeke_base_url.
// - Prioriza el bloque en 'sub' (más preciso para latest_episode).
// - Llama al bot Seeke con { latest_only: true } y guarda el número devuelto.
// - Título y cover se toman de anime_lists (evita cualquier consulta a AniList).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEEKE_BOT_URL = "https://a24785-ef25.xs001.jrnm.app/extraer";
const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

function normalizeSeekeUrl(baseUrl: string) {
  const clean = (baseUrl || "").trim();
  try {
    const u = new URL(clean);
    u.search = ""; u.hash = "";
    u.pathname = u.pathname.replace(/\/\d+\/?$/, "");
    return u.toString();
  } catch {
    return clean.replace(/\/\d+\/?$/, "");
  }
}

async function fetchSeekeLatest(baseUrl: string, hintEp: number): Promise<number | null> {
  const url = normalizeSeekeUrl(baseUrl);
  try {
    const r = await fetch(SEEKE_BOT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ url, ep: hintEp, latest_only: true, no_cache: true, force: true, cache_bust: Date.now() }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    const n = Number(data?.latest_episode);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch { return null; }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) Bloques Seeke de animes aprobados. Preferimos 'sub'.
    const { data: approved, error: e1 } = await supabase.from("approved_animes").select("anilist_id");
    if (e1) throw e1;
    const approvedSet = new Set<number>((approved || []).map((r: any) => r.anilist_id));

    const { data: blocks, error: e2 } = await supabase
      .from("video_cache_blocks")
      .select("anilist_id, lang, seeke_base_url, episode_to")
      .not("seeke_base_url", "is", null);
    if (e2) throw e2;

    // Elegir 1 bloque por anime: prioriza sub; fallback: cualquier otro con mayor episode_to
    const chosen = new Map<number, { url: string; hintEp: number }>();
    for (const b of blocks || []) {
      const id = (b as any).anilist_id as number;
      if (!approvedSet.has(id)) continue;
      const lang = String((b as any).lang || "").toLowerCase();
      const url = String((b as any).seeke_base_url || "").trim();
      const hintEp = Number((b as any).episode_to) || 1;
      if (!url) continue;
      const prev = chosen.get(id);
      if (!prev) { chosen.set(id, { url, hintEp }); continue; }
      // preferimos sub si el actual no lo es
      if (lang === "sub") { chosen.set(id, { url, hintEp }); }
    }

    if (chosen.size === 0) {
      return new Response(JSON.stringify({ message: "Sin bloques Seeke aprobados", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2) Estado previo
    const { data: current } = await supabase
      .from("auto_latest_episodes")
      .select("anilist_id, latest_episode, title, cover, banner");
    const prevMap = new Map<number, { latest: number; title: string | null; cover: string | null; banner: string | null }>(
      (current || []).map((r: any) => [r.anilist_id, {
        latest: r.latest_episode, title: r.title, cover: r.cover, banner: r.banner,
      }]),
    );

    // 3) Título/cover desde anime_lists (una consulta)
    const ids = Array.from(chosen.keys());
    const { data: metaRows } = await supabase
      .from("anime_lists")
      .select("anime_id, anime_title, anime_cover")
      .in("anime_id", ids);
    const metaMap = new Map<number, { title: string; cover: string | null }>();
    for (const m of metaRows || []) {
      const id = (m as any).anime_id as number;
      if (!metaMap.has(id)) {
        metaMap.set(id, { title: (m as any).anime_title || "Anime", cover: (m as any).anime_cover || null });
      }
    }

    let inserted = 0, updated = 0, unchanged = 0, failed = 0;

    for (const [id, { url, hintEp }] of chosen) {
      const prev = prevMap.get(id);
      const startEp = Math.max(prev?.latest || 0, hintEp, 1);
      const latest = await fetchSeekeLatest(url, startEp);

      if (!latest) { failed++; await new Promise((r) => setTimeout(r, 400)); continue; }

      const meta = metaMap.get(id);
      const title = meta?.title || prev?.title || "Anime";
      const cover = meta?.cover || prev?.cover || null;
      const banner = prev?.banner || null;

      if (!prev) {
        await supabase.from("auto_latest_episodes").insert({
          anilist_id: id, title, cover, banner,
          latest_episode: latest, previous_episode: 0,
          anilist_status: "RELEASING",
          episode_updated_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
        });
        inserted++;
      } else if (latest > prev.latest) {
        await supabase.from("auto_latest_episodes").update({
          title, cover,
          latest_episode: latest,
          previous_episode: prev.latest,
          episode_updated_at: new Date().toISOString(),
          last_checked_at: new Date().toISOString(),
        }).eq("anilist_id", id);
        updated++;
      } else {
        await supabase.from("auto_latest_episodes").update({
          title, cover, last_checked_at: new Date().toISOString(),
        }).eq("anilist_id", id);
        unchanged++;
      }

      // Respetar la VPS: pausa entre requests
      await new Promise((r) => setTimeout(r, 600));
    }

    return new Response(
      JSON.stringify({ message: "OK", checked: chosen.size, inserted, updated, unchanged, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: err(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
