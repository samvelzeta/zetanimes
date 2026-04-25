import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANILIST_URL = "https://graphql.anilist.co";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Get all trackers that are waiting or downloading (active ones)
    const { data: trackers, error } = await supabase
      .from("anime_download_tracker")
      .select("*")
      .in("status", ["waiting", "downloading"])
      .order("updated_at", { ascending: true })
      .limit(50);

    if (error) throw error;
    if (!trackers || trackers.length === 0) {
      return new Response(JSON.stringify({ message: "No active trackers", checked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let updated = 0;
    let newEpisodes = 0;

    for (const tracker of trackers) {
      try {
        // Query AniList for latest episode count
        const query = `
          query ($id: Int) {
            Media(id: $id, type: ANIME) {
              episodes
              nextAiringEpisode { episode timeUntilAiring }
              status
            }
          }
        `;
        const res = await fetch(ANILIST_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables: { id: tracker.anilist_id } }),
        });
        const json = await res.json();
        const media = json?.data?.Media;
        if (!media) continue;

        const currentTotal = media.episodes || 0;
        const nextEp = media.nextAiringEpisode?.episode || 0;
        const latestAvailable = nextEp > 0 ? nextEp - 1 : currentTotal;
        const storedTotal = tracker.total_episodes || 0;

        // If there are new episodes available
        if (latestAvailable > storedTotal) {
          // Update tracker total
          await supabase
            .from("anime_download_tracker")
            .update({
              total_episodes: currentTotal > 0 ? currentTotal : latestAvailable,
              airing_status: media.status,
            })
            .eq("id", tracker.id);

          // Add new episode entries
          const newEps = [];
          for (let ep = storedTotal + 1; ep <= latestAvailable; ep++) {
            newEps.push({
              tracker_id: tracker.id,
              episode_number: ep,
              downloaded: false,
            });
          }

          if (newEps.length > 0) {
            await supabase.from("anime_episode_downloads").insert(newEps);
            newEpisodes += newEps.length;
          }

          updated++;
        }

        // Rate limit AniList (30 req/min)
        await new Promise(r => setTimeout(r, 2100));
      } catch (e) {
        console.error(`Error checking ${tracker.title}:`, e);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Episode check complete",
        checked: trackers.length,
        updated,
        newEpisodes,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: errorMessage(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
