// Sistema de "Últimos Episodios" por-anime, disparado bajo demanda.
//
// Modos de invocación:
//  1) POST { anilist_id, status? } — el cliente lo llama cuando un usuario
//     abre la ficha de un anime. Solo consulta la VPS Seeke si:
//       - el anime está en emisión (RELEASING),
//       - existe un video_cache_blocks con seeke_base_url,
//       - han pasado >= 3 días desde last_checked_at (throttle).
//     Si el anime pasó a FINISHED/CANCELLED, borra su fila de
//     auto_latest_episodes (NO toca video_cache_blocks ni enlaces madre).
//  2) POST { cleanup: true } — barrido genérico: elimina de
//     auto_latest_episodes cualquier fila cuyo anime esté marcado como
//     FINISHED/CANCELLED en auto_latest_episodes.anilist_status. (El estado
//     se actualiza durante el propio track.)
//
// Nunca hace llamadas a AniList. Título/cover salen de anime_lists.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEEKE_BOT_URL = "https://a24785-ef25.xs001.jrnm.app/extraer";
const THROTTLE_MS = 1000 * 60 * 60 * 24 * 3; // 3 días

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

    const body = await req.json().catch(() => ({} as any));
    const anilistId = Number(body?.anilist_id) || 0;
    const clientStatus = String(body?.status || "").toUpperCase();
    const cleanupOnly = body?.cleanup === true;

    // -------- Modo cleanup: borra filas de animes ya finalizados --------
    if (cleanupOnly && !anilistId) {
      const { data: del, error } = await supabase
        .from("auto_latest_episodes")
        .delete()
        .in("anilist_status", ["FINISHED", "CANCELLED"])
        .select("anilist_id");
      if (error) throw error;
      return new Response(
        JSON.stringify({ message: "cleanup", removed: del?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!anilistId) {
      return new Response(JSON.stringify({ error: "anilist_id requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // -------- Anime finalizado/cancelado → limpiar tracker de ese anime --------
    if (clientStatus === "FINISHED" || clientStatus === "CANCELLED") {
      await supabase.from("auto_latest_episodes").delete().eq("anilist_id", anilistId);
      return new Response(
        JSON.stringify({ message: "removed_finished", anilist_id: anilistId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Solo trackeamos animes en emisión.
    if (clientStatus && clientStatus !== "RELEASING") {
      return new Response(
        JSON.stringify({ message: "skipped_not_releasing", status: clientStatus }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------- Elegir bloque Seeke (prioridad sub) --------
    const { data: blocks, error: e2 } = await supabase
      .from("video_cache_blocks")
      .select("lang, seeke_base_url, episode_to")
      .eq("anilist_id", anilistId)
      .not("seeke_base_url", "is", null);
    if (e2) throw e2;

    if (!blocks || blocks.length === 0) {
      return new Response(
        JSON.stringify({ message: "no_seeke_block", anilist_id: anilistId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sub = blocks.find((b: any) => String(b.lang || "").toLowerCase() === "sub");
    const chosen = sub || blocks[0];
    const seekeUrl = String((chosen as any).seeke_base_url || "").trim();
    const hintEp = Number((chosen as any).episode_to) || 1;
    if (!seekeUrl) {
      return new Response(
        JSON.stringify({ message: "no_seeke_url", anilist_id: anilistId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // -------- Throttle: si se chequeó hace < 3 días, no llamar a la VPS --------
    const { data: prev } = await supabase
      .from("auto_latest_episodes")
      .select("latest_episode, title, cover, banner, last_checked_at")
      .eq("anilist_id", anilistId)
      .maybeSingle();

    if (prev?.last_checked_at) {
      const age = Date.now() - new Date(prev.last_checked_at).getTime();
      if (age < THROTTLE_MS) {
        return new Response(
          JSON.stringify({
            message: "throttled",
            anilist_id: anilistId,
            next_check_in_ms: THROTTLE_MS - age,
            latest_episode: prev.latest_episode,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // -------- Título/cover desde anime_lists (evita AniList) --------
    let title = prev?.title || "Anime";
    let cover: string | null = prev?.cover || null;
    const { data: meta } = await supabase
      .from("anime_lists")
      .select("anime_title, anime_cover")
      .eq("anime_id", anilistId)
      .limit(1)
      .maybeSingle();
    if (meta) {
      title = (meta as any).anime_title || title;
      cover = (meta as any).anime_cover || cover;
    }

    // -------- Consulta Seeke --------
    const startEp = Math.max(prev?.latest_episode || 0, hintEp, 1);
    const latest = await fetchSeekeLatest(seekeUrl, startEp);
    if (!latest) {
      // Igual actualizamos last_checked_at para respetar el throttle.
      if (prev) {
        await supabase
          .from("auto_latest_episodes")
          .update({ last_checked_at: new Date().toISOString() })
          .eq("anilist_id", anilistId);
      }
      return new Response(
        JSON.stringify({ message: "seeke_failed", anilist_id: anilistId }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = new Date().toISOString();
    if (!prev) {
      await supabase.from("auto_latest_episodes").insert({
        anilist_id: anilistId,
        title,
        cover,
        banner: null,
        latest_episode: latest,
        previous_episode: 0,
        anilist_status: "RELEASING",
        episode_updated_at: now,
        last_checked_at: now,
      });
    } else if (latest > (prev.latest_episode || 0)) {
      await supabase.from("auto_latest_episodes").update({
        title, cover,
        latest_episode: latest,
        previous_episode: prev.latest_episode || 0,
        anilist_status: "RELEASING",
        episode_updated_at: now,
        last_checked_at: now,
      }).eq("anilist_id", anilistId);
    } else {
      await supabase.from("auto_latest_episodes").update({
        title, cover,
        anilist_status: "RELEASING",
        last_checked_at: now,
      }).eq("anilist_id", anilistId);
    }

    return new Response(
      JSON.stringify({ message: "ok", anilist_id: anilistId, latest_episode: latest }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: err(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
