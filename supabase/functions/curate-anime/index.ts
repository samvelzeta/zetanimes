import { createClient } from "npm:@supabase/supabase-js@2";
import { assertInternalCaller } from "../_shared/cron-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANILIST_URL = "https://graphql.anilist.co";

type AniListRow = {
  id: number;
  title?: { romaji?: string | null; english?: string | null } | null;
  countryOfOrigin?: string | null;
  tags?: { name?: string | null }[] | null;
};

function reasonFor(anime: AniListRow) {
  if (anime.countryOfOrigin === "CN") return "Origen China";
  if (anime.tags?.some((tag) => (tag.name || "").trim().toLowerCase() === "chibi")) return "Etiqueta Chibi";
  return null;
}

async function fetchAniList(ids: number[]): Promise<AniListRow[]> {
  const query = `
    query($ids:[Int]) {
      Page(page:1, perPage:50) {
        media(id_in:$ids, type:ANIME, isAdult:false) {
          id
          title { romaji english }
          countryOfOrigin
          tags { name }
        }
      }
    }
  `;
  const res = await fetch(ANILIST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables: { ids } }),
  });
  if (!res.ok) throw new Error(`AniList ${res.status}`);
  const json = await res.json();
  return json?.data?.Page?.media || [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await assertInternalCaller(req, {});
  if (denied) return new Response(denied.body, { status: denied.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const body = await req.json().catch(() => ({}));
    const ids = Array.from(new Set((Array.isArray(body?.ids) ? body.ids : [])
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isInteger(id) && id > 0)
      .slice(0, 50))) as number[];
    if (!ids.length) return new Response(JSON.stringify({ hiddenIds: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: existing } = await supabase
      .from("hidden_home_animes")
      .select("anilist_id,is_hidden")
      .in("anilist_id", ids);
    const existingMap = new Map((existing || []).map((row: any) => [row.anilist_id, row.is_hidden]));

    const media = await fetchAniList(ids.filter((id) => !existingMap.has(id)));
    const autoRows = media
      .map((anime) => ({ anime, reason: reasonFor(anime) }))
      .filter((item) => !!item.reason)
      .map(({ anime, reason }) => ({
        anilist_id: anime.id,
        anime_title: anime.title?.english || anime.title?.romaji || `Anime ${anime.id}`,
        reason,
        country_of_origin: anime.countryOfOrigin ?? null,
        tags: (anime.tags || []).map((tag) => tag.name).filter(Boolean),
        auto_hidden: true,
        source: "anilist-filter",
        is_hidden: true,
      }));

    if (autoRows.length) {
      await supabase.from("hidden_home_animes").upsert(autoRows, { onConflict: "anilist_id" });
      autoRows.forEach((row) => existingMap.set(row.anilist_id, true));
    }

    const hiddenIds = Array.from(existingMap.entries()).filter(([, hidden]) => hidden === true).map(([id]) => id);
    return new Response(JSON.stringify({ hiddenIds, persisted: autoRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "unknown_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});