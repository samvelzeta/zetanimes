// Sincroniza `auto_latest_episodes` con AniList cada 24h.
// - Toma los animes aprobados que ya tienen al menos un video en `video_cache`.
// - Consulta AniList: si sube el número de episodios (o cambia nextAiringEpisode), guarda el nuevo.
// - Si el anime pasa a FINISHED, se elimina de la tabla.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANILIST_URL = "https://graphql.anilist.co";
const err = (e: unknown) => (e instanceof Error ? e.message : String(e));

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1) animes aprobados que ya tienen al menos un enlace de video
    const { data: cacheRows, error: e1 } = await supabase
      .from("video_cache")
      .select("anilist_id")
      .not("anilist_id", "is", null);
    if (e1) throw e1;
    const withVideoIds = Array.from(
      new Set((cacheRows || []).map((r: any) => r.anilist_id).filter(Boolean)),
    ) as number[];

    const { data: approved, error: e2 } = await supabase
      .from("approved_animes")
      .select("anilist_id");
    if (e2) throw e2;
    const approvedSet = new Set<number>((approved || []).map((r: any) => r.anilist_id));

    const targetIds = withVideoIds.filter((id) => approvedSet.has(id));
    if (targetIds.length === 0) {
      return new Response(
        JSON.stringify({ message: "Sin animes elegibles", checked: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) estado actual guardado
    const { data: current } = await supabase
      .from("auto_latest_episodes")
      .select("anilist_id, latest_episode, anilist_status");
    const currentMap = new Map<number, { latest_episode: number; anilist_status: string | null }>(
      (current || []).map((r: any) => [r.anilist_id, { latest_episode: r.latest_episode, anilist_status: r.anilist_status }]),
    );

    let updated = 0, removed = 0, inserted = 0;
    const query = `
      query ($id: Int) {
        Media(id: $id, type: ANIME) {
          id
          episodes
          status
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          nextAiringEpisode { episode }
        }
      }
    `;

    for (const id of targetIds) {
      try {
        const r = await fetch(ANILIST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { id } }),
        });
        const j = await r.json();
        const m = j?.data?.Media;
        if (!m) continue;

        // Si terminó, se descarta del tracking
        if (m.status === "FINISHED" || m.status === "CANCELLED") {
          await supabase.from("auto_latest_episodes").delete().eq("anilist_id", id);
          removed++;
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }

        // Solo trackeamos RELEASING
        if (m.status !== "RELEASING") {
          await new Promise((r) => setTimeout(r, 700));
          continue;
        }

        const nextEp = m.nextAiringEpisode?.episode || 0;
        const latest = nextEp > 0 ? nextEp - 1 : (m.episodes || 0);
        if (latest <= 0) { await new Promise((r) => setTimeout(r, 700)); continue; }

        const title = m.title?.english || m.title?.romaji || m.title?.native || "Anime";
        const cover = m.coverImage?.extraLarge || m.coverImage?.large || null;
        const banner = m.bannerImage || null;

        const prev = currentMap.get(id);
        if (!prev) {
          await supabase.from("auto_latest_episodes").insert({
            anilist_id: id, title, cover, banner,
            latest_episode: latest, previous_episode: 0,
            anilist_status: m.status,
            episode_updated_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
          });
          inserted++;
        } else if (latest > prev.latest_episode) {
          await supabase.from("auto_latest_episodes").update({
            title, cover, banner,
            latest_episode: latest,
            previous_episode: prev.latest_episode,
            anilist_status: m.status,
            episode_updated_at: new Date().toISOString(),
            last_checked_at: new Date().toISOString(),
          }).eq("anilist_id", id);
          updated++;
        } else {
          await supabase.from("auto_latest_episodes").update({
            title, cover, banner, anilist_status: m.status,
            last_checked_at: new Date().toISOString(),
          }).eq("anilist_id", id);
        }

        // Respetar rate limit AniList (~30/min)
        await new Promise((r) => setTimeout(r, 2100));
      } catch (e) {
        console.error(`Anime ${id} falló:`, err(e));
      }
    }

    return new Response(
      JSON.stringify({ message: "OK", checked: targetIds.length, inserted, updated, removed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: err(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
