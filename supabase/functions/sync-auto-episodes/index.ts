// Sistema de "Últimos Episodios" por-anime.
//
// Modos:
//  1) POST { anilist_id, status? } — track individual (respeta throttle 3d)
//  2) POST { cleanup: true } — borra filas de animes FINISHED/CANCELLED
//  3) POST { scan: true, limit? } — recorre TODOS los animes con enlace
//     Seeke que estén pendientes de refresco (nunca trackeados o >3 días)
//     y los procesa uno por uno. Ideal para llamarse al abrir Home.
//
// NUNCA borra video_cache_blocks ni enlaces madre.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SEEKE_BOT_URL = "https://a24785-7a2f.xs1.onjrnm.link/extraer";
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

type SupaClient = ReturnType<typeof createClient>;

async function trackOne(supabase: SupaClient, anilistId: number, clientStatus: string) {
  // Finalizado → limpiar tracker
  if (clientStatus === "FINISHED" || clientStatus === "CANCELLED") {
    await supabase.from("auto_latest_episodes").delete().eq("anilist_id", anilistId);
    return { message: "removed_finished", anilist_id: anilistId };
  }
  if (clientStatus && clientStatus !== "RELEASING") {
    return { message: "skipped_not_releasing", status: clientStatus };
  }

  // 1) Buscar en video_cache_blocks (sub prioridad → latino → cualquiera)
  const { data: blocks } = await supabase
    .from("video_cache_blocks")
    .select("lang, seeke_base_url, episode_to")
    .eq("anilist_id", anilistId)
    .not("seeke_base_url", "is", null);

  let seekeUrl = "";
  let hintEp = 1;

  if (blocks && blocks.length > 0) {
    const sub = blocks.find((b: any) => String(b.lang || "").toLowerCase() === "sub");
    const lat = blocks.find((b: any) => String(b.lang || "").toLowerCase() === "latino");
    const chosen = sub || lat || blocks[0];
    seekeUrl = String((chosen as any).seeke_base_url || "").trim();
    hintEp = Number((chosen as any).episode_to) || 1;
  } else {
    // 2) Fallback: video_cache episode=0 con sources.seeke (enlace madre clásico)
    const { data: masters } = await supabase
      .from("video_cache")
      .select("sources, lang")
      .eq("anilist_id", anilistId)
      .eq("episode", 0)
      .not("sources->seeke", "is", null);
    if (!masters || masters.length === 0) {
      return { message: "no_seeke_master", anilist_id: anilistId };
    }
    const pickUrl = (m: any) => {
      const arr = (m?.sources?.seeke || []) as string[];
      return Array.isArray(arr) && arr.length ? String(arr[0] || "").trim() : "";
    };
    const sub = masters.find((m: any) => String(m.lang || "").toLowerCase() === "sub" && pickUrl(m));
    const lat = masters.find((m: any) => String(m.lang || "").toLowerCase() === "latino" && pickUrl(m));
    const chosen = sub || lat || masters.find((m: any) => pickUrl(m));
    if (chosen) seekeUrl = pickUrl(chosen);
  }

  if (!seekeUrl) return { message: "no_seeke_url", anilist_id: anilistId };

  const { data: prev } = await supabase
    .from("auto_latest_episodes")
    .select("latest_episode, title, cover, banner, last_checked_at")
    .eq("anilist_id", anilistId)
    .maybeSingle();

  if (prev?.last_checked_at) {
    const age = Date.now() - new Date(prev.last_checked_at as string).getTime();
    if (age < THROTTLE_MS) {
      return { message: "throttled", anilist_id: anilistId, next_check_in_ms: THROTTLE_MS - age };
    }
  }

  let title = (prev as any)?.title || "Anime";
  let cover: string | null = (prev as any)?.cover || null;
  let banner: string | null = (prev as any)?.banner || null;
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

  // Fallback a AniList si aún falta cover
  if (!cover) {
    try {
      const q = `query($id:Int){Media(id:$id,type:ANIME){title{romaji english native} coverImage{extraLarge large} bannerImage}}`;
      const r = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: q, variables: { id: anilistId } }),
      });
      if (r.ok) {
        const j = await r.json();
        const m = j?.data?.Media;
        if (m) {
          cover = m.coverImage?.extraLarge || m.coverImage?.large || cover;
          banner = m.bannerImage || banner;
          title = m.title?.english || m.title?.romaji || m.title?.native || title;
        }
      }
    } catch { /* ignore */ }
  }


  const startEp = Math.max((prev as any)?.latest_episode || 0, hintEp, 1);
  const latest = await fetchSeekeLatest(seekeUrl, startEp);
  if (!latest) {
    if (prev) {
      await supabase.from("auto_latest_episodes")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("anilist_id", anilistId);
    }
    return { message: "seeke_failed", anilist_id: anilistId };
  }

  const now = new Date().toISOString();
  if (!prev) {
    await supabase.from("auto_latest_episodes").insert({
      anilist_id: anilistId, title, cover, banner,
      latest_episode: latest, previous_episode: 0,
      anilist_status: "RELEASING",
      episode_updated_at: now, last_checked_at: now,
    });
  } else if (latest > ((prev as any).latest_episode || 0)) {
    await supabase.from("auto_latest_episodes").update({
      title, cover, banner, latest_episode: latest,
      previous_episode: (prev as any).latest_episode || 0,
      anilist_status: "RELEASING",
      episode_updated_at: now, last_checked_at: now,
    }).eq("anilist_id", anilistId);
  } else {
    await supabase.from("auto_latest_episodes").update({
      title, cover, banner, anilist_status: "RELEASING", last_checked_at: now,
    }).eq("anilist_id", anilistId);
  }
  return { message: "ok", anilist_id: anilistId, latest_episode: latest };
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
    const scan = body?.scan === true;
    const scanLimit = Math.max(1, Math.min(50, Number(body?.limit) || 15));

    if (cleanupOnly && !anilistId) {
      const { data: del, error } = await supabase
        .from("auto_latest_episodes")
        .delete()
        .in("anilist_status", ["FINISHED", "CANCELLED"])
        .select("anilist_id");
      if (error) throw error;
      return new Response(JSON.stringify({ message: "cleanup", removed: del?.length || 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // -------- Modo SCAN --------
    if (scan) {
      // Todos los anilist_id con enlace Seeke — bloques Y video_cache madre (episode=0)
      const [{ data: blocks }, { data: masters }] = await Promise.all([
        supabase.from("video_cache_blocks").select("anilist_id").not("seeke_base_url", "is", null),
        supabase.from("video_cache").select("anilist_id").eq("episode", 0).not("sources->seeke", "is", null),
      ]);
      const allIds = Array.from(new Set([
        ...((blocks || []).map((b: any) => Number(b.anilist_id))),
        ...((masters || []).map((m: any) => Number(m.anilist_id))),
      ].filter(Boolean)));

      // Estados actuales trackeados
      const { data: tracked } = await supabase
        .from("auto_latest_episodes")
        .select("anilist_id, last_checked_at, anilist_status")
        .in("anilist_id", allIds.length ? allIds : [0]);
      const trackedMap = new Map<number, { last: number; status: string }>();
      (tracked || []).forEach((t: any) => {
        trackedMap.set(Number(t.anilist_id), {
          last: t.last_checked_at ? new Date(t.last_checked_at).getTime() : 0,
          status: String(t.anilist_status || ""),
        });
      });

      const now = Date.now();
      const pending = allIds.filter((id) => {
        const t = trackedMap.get(id);
        if (!t) return true; // nunca trackeado
        if (t.status === "FINISHED" || t.status === "CANCELLED") return false;
        return (now - t.last) >= THROTTLE_MS;
      }).slice(0, scanLimit);

      // Verificar estado real en AniList (lotes de 50)
      const statusMap = new Map<number, string>();
      for (let i = 0; i < pending.length; i += 50) {
        const batch = pending.slice(i, i + 50);
        try {
          const q = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id status}}}`;
          const r = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ query: q, variables: { ids: batch } }),
          });
          if (r.ok) {
            const j = await r.json();
            (j?.data?.Page?.media || []).forEach((m: any) => {
              statusMap.set(Number(m.id), String(m.status || ""));
            });
          }
        } catch { /* ignore */ }
      }

      const results: any[] = [];
      let cleaned = 0;
      for (const id of pending) {
        const realStatus = statusMap.get(id) || "";
        if (realStatus === "FINISHED" || realStatus === "CANCELLED") {
          const { data: del } = await supabase
            .from("auto_latest_episodes").delete().eq("anilist_id", id).select("anilist_id");
          if (del && del.length) cleaned++;
          results.push({ anilist_id: id, message: "skipped_" + realStatus.toLowerCase() });
          continue;
        }
        if (realStatus && realStatus !== "RELEASING") {
          results.push({ anilist_id: id, message: "skipped_" + realStatus.toLowerCase() });
          continue;
        }
        try {
          const r = await trackOne(supabase, id, "RELEASING");
          results.push(r);
        } catch (e) {
          results.push({ anilist_id: id, error: err(e) });
        }
      }

      // Cleanup: elimina cualquier fila cuyo estado real ya no sea RELEASING
      const { data: allTracked } = await supabase
        .from("auto_latest_episodes").select("anilist_id");
      const trackedIds = (allTracked || []).map((t: any) => Number(t.anilist_id));
      const notReleasing: number[] = [];
      for (let i = 0; i < trackedIds.length; i += 50) {
        const batch = trackedIds.slice(i, i + 50);
        try {
          const q = `query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id status}}}`;
          const r = await fetch("https://graphql.anilist.co", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: q, variables: { ids: batch } }),
          });
          if (r.ok) {
            const j = await r.json();
            (j?.data?.Page?.media || []).forEach((m: any) => {
              if (String(m.status) !== "RELEASING") notReleasing.push(Number(m.id));
            });
          }
        } catch { /* ignore */ }
      }
      if (notReleasing.length) {
        const { data: del } = await supabase
          .from("auto_latest_episodes").delete().in("anilist_id", notReleasing).select("anilist_id");
        cleaned += del?.length || 0;
      }

      return new Response(JSON.stringify({
        message: "scan_done",
        total_candidates: allIds.length,
        pending: pending.length,
        processed: results.length,
        cleaned,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!anilistId) {
      return new Response(JSON.stringify({ message: "noop", reason: "no_anilist_id" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const result = await trackOne(supabase, anilistId, clientStatus);
    return new Response(JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: err(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
