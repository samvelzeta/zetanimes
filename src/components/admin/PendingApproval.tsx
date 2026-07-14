import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRecentlyUpdated, getRecentReleasedMovies, getMovies, getUpcomingMovies, getTrending, getPopular, getTopRated, getThisSeason } from "@/lib/anilist";
import { getApprovedAnimeIds, approveAnime, onApprovedChange } from "@/lib/approved-animes";
import { saveCachedVideo, getCachedVideo } from "@/lib/video-cache";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, Link2, Search, ShieldCheck, Play, Settings2, Save, GitBranch, ChevronDown, Film, Tv } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import LazyImage from "@/components/LazyImage";
import { logAdminActivity } from "@/lib/admin-log";
import { getPrequelChain, getSideStories, getAnimeIdsWithSeekeMaster, type PrequelNode } from "@/lib/anime-prequels";
import { hidePendingAnime, listHiddenPending, unhidePendingAnime } from "@/lib/hidden-pending-animes";
import { unhideAnime } from "@/lib/hidden-animes";
import { fuzzyTextScore, normalizeSearchText } from "@/lib/search-utils";
import { getStatusLabel } from "@/lib/anilist";


type AiringItem = {
  id: number;
  title: { romaji?: string; english?: string | null };
  coverImage?: { large?: string; extraLarge?: string };
  status: string;
  episodes?: number | null;
  averageScore?: number | null;
  format?: string | null;
};

type PendingGroup = {
  main: AiringItem;
  related: AiringItem[];
};

function formatLabel(f?: string | null): string {
  if (!f) return "";
  const m: Record<string, string> = {
    TV: "SERIE", TV_SHORT: "SERIE CORTA", MOVIE: "PELÍCULA",
    OVA: "OVA", ONA: "ONA", SPECIAL: "ESPECIAL", MUSIC: "MÚSICA",
  };
  return m[f] || f;
}

function isMovieFormat(f?: string | null) {
  return f === "MOVIE";
}

function titleOf(a: AiringItem) {
  return a.title?.english || a.title?.romaji || `Anime #${a.id}`;
}

function slugFromTitle(t: string) {
  return t
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

export default function PendingApproval() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [showApproved, setShowApproved] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const { data: hiddenList = [], refetch: refetchHidden } = useQuery({
    queryKey: ["hidden-pending-animes"],
    queryFn: listHiddenPending,
    staleTime: 1000 * 60,
  });
  const hiddenSet = useMemo(() => new Set<number>(hiddenList.map((h) => h.anilist_id)), [hiddenList]);

  // 3 páginas de RELEASING para tener suficiente pool
  // Auto-refresh diario (24h). Botón manual disponible para forzar refresh.
  const DAILY_MS = 1000 * 60 * 60 * 24;

  const { data: p1, isLoading: l1, refetch: rp1 } = useQuery({
    queryKey: ["airing-page", 1],
    queryFn: () => getRecentlyUpdated(1, 50),
    staleTime: 1000 * 60 * 15,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
  });
  const { data: p2, isLoading: l2, refetch: rp2 } = useQuery({
    queryKey: ["airing-page", 2],
    queryFn: () => getRecentlyUpdated(2, 50),
    staleTime: 1000 * 60 * 15,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
  });
  const { data: p3, isLoading: l3, refetch: rp3 } = useQuery({
    queryKey: ["airing-page", 3],
    queryFn: () => getRecentlyUpdated(3, 50),
    staleTime: 1000 * 60 * 15,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
  });

  const { data: movies, isLoading: lm, refetch: rm } = useQuery({
    queryKey: ["recent-released-movies", 1],
    queryFn: () => getRecentReleasedMovies(1, 30),
    staleTime: 1000 * 60 * 30,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
  });

  const { data: dirMovies, isLoading: lm2, refetch: rdm } = useQuery({
    queryKey: ["directory-movies-pending", 1],
    queryFn: () => getMovies(1, 30, null),
    staleTime: 1000 * 60 * 30,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
  });
  const { data: dirUpcoming, isLoading: lm3, refetch: rdu } = useQuery({
    queryKey: ["directory-upcoming-movies-pending", 1],
    queryFn: () => getUpcomingMovies(1, 20),
    staleTime: 1000 * 60 * 60,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
  });

  const { data: homeTrending, refetch: rht } = useQuery({
    queryKey: ["pending-home-trending"], queryFn: () => getTrending(1, 30),
    staleTime: 1000 * 60 * 30, refetchInterval: DAILY_MS, refetchIntervalInBackground: false,
  });
  const { data: homePopular, refetch: rhp } = useQuery({
    queryKey: ["pending-home-popular"], queryFn: () => getPopular(1, 30),
    staleTime: 1000 * 60 * 30, refetchInterval: DAILY_MS, refetchIntervalInBackground: false,
  });
  const { data: homeTop, refetch: rhtop } = useQuery({
    queryKey: ["pending-home-top"], queryFn: () => getTopRated(1, 30),
    staleTime: 1000 * 60 * 30, refetchInterval: DAILY_MS, refetchIntervalInBackground: false,
  });
  const { data: homeSeason, refetch: rhs } = useQuery({
    queryKey: ["pending-home-season"], queryFn: () => getThisSeason(1, 30),
    staleTime: 1000 * 60 * 30, refetchInterval: DAILY_MS, refetchIntervalInBackground: false,
  });

  // Páginas extra dinámicas: si tras filtrar quedan <10 pendientes, pedimos
  // más páginas de AniList (RELEASING + películas) para reponer la cola.
  const MIN_PENDING = 10;
  const MAX_EXTRA_PAGES = 12; // hasta ~12 páginas extra (600 items adicionales)
  const [extraPages, setExtraPages] = useState(0);

  const { data: extraItems, refetch: rExtra, isFetching: extraFetching } = useQuery({
    queryKey: ["airing-extra-pages", extraPages],
    enabled: extraPages > 0,
    staleTime: 1000 * 60 * 30,
    refetchInterval: DAILY_MS,
    refetchIntervalInBackground: false,
    queryFn: async () => {
      const out: AiringItem[] = [];
      for (let i = 0; i < extraPages; i++) {
        const page = 4 + i;
        const [rel, mov] = await Promise.all([
          getRecentlyUpdated(page, 50).catch(() => ({ media: [] as AiringItem[] })),
          getMovies(page, 30, null).catch(() => ({ media: [] as AiringItem[] })),
        ]);
        out.push(...((rel.media || []) as AiringItem[]));
        out.push(...((mov.media || []) as AiringItem[]));
      }
      return out;
    },
  });

  const [refreshing, setRefreshing] = useState(false);
  async function handleManualRefresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        rp1(), rp2(), rp3(), rm(), rdm(), rdu(),
        rht(), rhp(), rhtop(), rhs(), refetchHidden(), refetchSeeke(),
        extraPages > 0 ? rExtra() : Promise.resolve(),
      ]);
      toast.success("Pendientes actualizado");
    } catch {
      toast.error("Error refrescando");
    } finally {
      setRefreshing(false);
    }
  }



  const { data: approvedArr, refetch: refetchApproved } = useQuery({
    queryKey: ["approved-anime-ids"],
    queryFn: async () => Array.from(await getApprovedAnimeIds(true)),
    staleTime: 1000 * 60 * 5,
  });
  const approvedSet = useMemo(() => new Set<number>(approvedArr || []), [approvedArr]);
  

  // ¿Qué animes ya tienen enlace madre Seeke (episode=0)? Este set es el que
  // determina si una temporada puede considerarse "lista" para aprobarse sola.
  const { data: seekeMasterSet, refetch: refetchSeeke } = useQuery({
    queryKey: ["approval-seeke-master-ids"],
    queryFn: async () => getAnimeIdsWithSeekeMaster(),
    staleTime: 1000 * 60 * 2,
  });

  // Cualquier fila en video_cache (para badge "con enlace" general)
  const { data: withVideo } = useQuery({
    queryKey: ["approval-videocache-ids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("video_cache")
        .select("anilist_id")
        .not("anilist_id", "is", null)
        .limit(2000);
      return new Set<number>((data || []).map((r: any) => r.anilist_id as number));
    },
    staleTime: 1000 * 60 * 2,
  });

  const airingItems = useMemo<AiringItem[]>(() => {
    const map = new Map<number, AiringItem>();
    // Fuentes "core" — siempre se incluyen (RELEASING + películas próximas/recientes)
    for (const p of [p1, p2, p3, movies, dirMovies, dirUpcoming]) {
      for (const m of (p?.media || []) as AiringItem[]) {
        // Si ya tiene enlace madre Seeke o bloques → aprobado permanente, no volver a pedirlo
        if (seekeMasterSet?.has(m.id)) continue;
        if (!map.has(m.id)) map.set(m.id, m);
      }
    }
    // Páginas extra dinámicas: se piden cuando la cola de pendientes baja de 10.
    for (const m of (extraItems || [])) {
      if (seekeMasterSet?.has(m.id)) continue;
      if (m.status === "NOT_YET_RELEASED" || m.status === "CANCELLED") continue;
      if (!map.has(m.id)) map.set(m.id, m);
    }
    // Fuentes del Home — sólo entran si ya cambiaron de estado y aún no tienen
    // enlace madre Seeke. Descartamos NOT_YET_RELEASED / CANCELLED (ocultos hasta salir).
    for (const p of [homeTrending, homePopular, homeTop, homeSeason]) {
      for (const m of (p?.media || []) as AiringItem[]) {
        if (map.has(m.id)) continue;
        if (m.status === "NOT_YET_RELEASED" || m.status === "CANCELLED") continue;
        if (seekeMasterSet?.has(m.id)) continue; // ya tiene enlace madre → nada que aprobar aquí
        map.set(m.id, m);
      }
    }
    return Array.from(map.values());
  }, [p1, p2, p3, movies, dirMovies, dirUpcoming, extraItems, homeTrending, homePopular, homeTop, homeSeason, seekeMasterSet]);

  // Cadena de precuelas por cada item (cacheada en IDB dentro del helper).
  const { data: prequelMap } = useQuery({
    queryKey: ["approval-prequel-chains", airingItems.map((a) => a.id).join(",")],
    enabled: airingItems.length > 0,
    queryFn: async () => {
      const out = new Map<number, PrequelNode[]>();
      const ids = airingItems.map((a) => a.id);
      const CONC = 5;
      for (let i = 0; i < ids.length; i += CONC) {
        const slice = ids.slice(i, i + CONC);
        const results = await Promise.all(slice.map((id) => getPrequelChain(id).catch(() => [])));
        slice.forEach((id, idx) => out.set(id, results[idx] || []));
      }
      return out;
    },
    staleTime: 1000 * 60 * 30,
  });

  // Side stories directas por cada item en emisión — solo se inyectan las que
  // están RELEASING y aún no tienen enlace madre Seeke.
  const releasingIds = useMemo(
    () => airingItems.filter((a) => a.status === "RELEASING").map((a) => a.id),
    [airingItems],
  );
  const { data: sideMap } = useQuery({
    queryKey: ["approval-side-stories", releasingIds.join(",")],
    enabled: releasingIds.length > 0,
    queryFn: async () => {
      const out = new Map<number, PrequelNode[]>();
      const CONC = 5;
      for (let i = 0; i < releasingIds.length; i += CONC) {
        const slice = releasingIds.slice(i, i + CONC);
        const results = await Promise.all(slice.map((id) => getSideStories(id).catch(() => [])));
        slice.forEach((id, idx) => out.set(id, results[idx] || []));
      }
      return out;
    },
    staleTime: 1000 * 60 * 30,
  });

  // Agrupa precuelas y side stories SIN enlace madre Seeke bajo su anime padre.
  // Así el admin ve cada grupo separado en un desplegable en vez de mezclarse.
  const groups = useMemo<PendingGroup[]>(() => {
    if (!prequelMap || !seekeMasterSet) return airingItems.map((m) => ({ main: m, related: [] }));

    // Todo item que aparece como "related" no debe volverse main independiente
    const claimedAsRelated = new Set<number>();
    const mainIds = new Set<number>(airingItems.map((a) => a.id));

    const buildRelated = (parentId: number): AiringItem[] => {
      const list: AiringItem[] = [];
      const seen = new Set<number>();
      const chain = prequelMap.get(parentId) || [];
      for (const p of chain) {
        if (seekeMasterSet.has(p.id) || seen.has(p.id) || mainIds.has(p.id) && p.id !== parentId) continue;
        if (p.id === parentId) continue;
        seen.add(p.id);
        claimedAsRelated.add(p.id);
        list.push({
          id: p.id,
          title: { english: p.title, romaji: p.title },
          coverImage: { large: p.cover, extraLarge: p.cover },
          status: p.status || "FINISHED",
          episodes: p.episodes ?? null,
          averageScore: null,
          format: p.format ?? null,
        });
      }
      const sides = sideMap?.get(parentId) || [];
      for (const s of sides) {
        if (seekeMasterSet.has(s.id) || seen.has(s.id) || mainIds.has(s.id)) continue;
        if (s.status !== "RELEASING") continue;
        seen.add(s.id);
        claimedAsRelated.add(s.id);
        list.push({
          id: s.id,
          title: { english: s.title, romaji: s.title },
          coverImage: { large: s.cover, extraLarge: s.cover },
          status: s.status,
          episodes: s.episodes ?? null,
          averageScore: null,
          format: s.format ?? null,
        });
      }
      return list;
    };

    const result: PendingGroup[] = [];
    for (const main of airingItems) {
      result.push({ main, related: buildRelated(main.id) });
    }
    // Filtra grupos cuyo main haya sido reclamado como related de otro (no debería pasar, pero por seguridad)
    return result.filter((g) => !claimedAsRelated.has(g.main.id));
  }, [airingItems, prequelMap, sideMap, seekeMasterSet]);

  // Auto-aprobar: si el item TIENE enlace madre Seeke y TODAS sus precuelas
  // también → lo mandamos directo a "aprobados" sin que el admin toque nada.
  const autoApproveRunRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!seekeMasterSet || !prequelMap) return;
    const runOnce = autoApproveRunRef.current;
    (async () => {
      for (const item of airingItems) {
        if (runOnce.has(item.id)) continue;
        if (approvedSet.has(item.id)) continue;
        if (!seekeMasterSet.has(item.id)) continue;
        const chain = prequelMap.get(item.id) || [];
        const allPrequelsReady = chain.every((p) => seekeMasterSet.has(p.id));
        if (!allPrequelsReady) continue;
        runOnce.add(item.id);
        try {
          const res = await approveAnime(item.id);
          if (res.success) {
            await supabase.from("anime_download_tracker").upsert({
              anilist_id: item.id,
              title: titleOf(item),
              cover_image: item.coverImage?.large || null,
              total_episodes: item.episodes || 0,
              status: "completed",
              airing_status: item.status || null,
              updated_at: new Date().toISOString(),
            } as any, { onConflict: "anilist_id" });
            // Si estaba oculto del Home, lo desocultamos automáticamente al aprobar
            try { await unhideAnime(item.id); } catch {}
            await logAdminActivity({
              area: "videos",
              action: "auto_approve_anime",
              summary: `Auto-aprobado (tenía Seeke + precuelas listas): ${titleOf(item)}`,
              target_type: "anime",
              target_id: String(item.id),
              anilist_id: item.id,
              anime_title: titleOf(item),
            });
          }
        } catch (e) {
          console.warn("[auto-approve] failed", item.id, e);
        }
      }
    })();
  }, [airingItems, seekeMasterSet, prequelMap, approvedSet]);

  const filteredGroups = useMemo(() => {
    const q = normalizeSearchText(query);
    const matches = (a: AiringItem) => {
      const isApproved = approvedSet.has(a.id);
      const isHidden = hiddenSet.has(a.id);
      if (showHidden) {
        if (!isHidden) return false;
      } else {
        if (isHidden) return false;
        if (showApproved ? !isApproved : isApproved) return false;
      }
      if (!q) return true;
      return fuzzyTextScore(q, [titleOf(a), a.title?.romaji, a.title?.english, String(a.id)]) >= 1.1;
    };

    const out: (PendingGroup & { showMain: boolean })[] = [];
    for (const g of groups) {
      const mainHidden = hiddenSet.has(g.main.id);
      const mainApproved = approvedSet.has(g.main.id);
      // En vista "Ocultos": sólo grupos con main oculto
      if (showHidden && !mainHidden && !g.related.some((r) => hiddenSet.has(r.id))) continue;
      // En vista "Pendientes"/"Aprobados": si main está oculto, ocultamos todo el grupo
      if (!showHidden && mainHidden) continue;

      const mainOk = matches(g.main);
      const relatedOk = g.related.filter(matches);
      if (!mainOk && relatedOk.length === 0) continue;

      // Si estamos en "Pendientes" y el main está aprobado pero hay related pendientes,
      // renderizamos el grupo SIN el main (sólo las relacionadas pendientes).
      const hideMain = !showHidden && !showApproved && mainApproved && !mainOk && relatedOk.length > 0;
      out.push({ main: g.main, related: relatedOk, showMain: !hideMain && mainOk });
    }
    return out;
  }, [groups, query, approvedSet, showApproved, showHidden, hiddenSet]);


  useEffect(() => onApprovedChange(() => { refetchApproved(); refetchSeeke(); }), [refetchApproved, refetchSeeke]);

  const loading = l1 || l2 || l3 || lm || lm2 || lm3;

  const allItems = useMemo(() => {
    const ids = new Set<number>();
    for (const g of groups) {
      ids.add(g.main.id);
      g.related.forEach((r) => ids.add(r.id));
    }
    return Array.from(ids);
  }, [groups]);
  const pendingCount = allItems.filter((id) => !approvedSet.has(id) && !hiddenSet.has(id)).length;
  // Aprobados: contamos TODOS los aprobados de la BD (no sólo los del pool actual de AniList),
  // descontando los que estén ocultos.
  const approvedCount = (approvedArr || []).filter((id) => !hiddenSet.has(id)).length;
  const hiddenCount = hiddenSet.size;

  // Si tras filtrar quedan menos de MIN_PENDING pendientes y aún no llegamos al
  // tope de páginas extra, pedimos otra página de AniList automáticamente.
  useEffect(() => {
    if (loading || extraFetching) return;
    if (!seekeMasterSet) return; // esperamos a saber cuáles ya están aprobados
    if (pendingCount >= MIN_PENDING) return;
    if (extraPages >= MAX_EXTRA_PAGES) return;
    setExtraPages((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCount, loading, extraFetching, seekeMasterSet, extraPages]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-black text-foreground">Pendientes de Aprobación</h2>
            <p className="text-xs text-muted-foreground">
              Los animes en emisión detectados desde AniList aparecen aquí ocultos del Home hasta que
              agregues un enlace Seeke y los apruebes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => { setShowApproved(false); setShowHidden(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              !showApproved && !showHidden ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Pendientes ({pendingCount})
          </button>
          <button
            onClick={() => { setShowApproved(true); setShowHidden(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              showApproved && !showHidden ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
          >
            Aprobados ({approvedCount})
          </button>
          <button
            onClick={() => { setShowHidden(true); setShowApproved(false); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              showHidden ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
            }`}
            title="Animes ocultos 7 días — puedes devolverlos a la bandeja"
          >
            Ocultos 7d ({hiddenCount})
          </button>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por título o ID…"
              className="pl-8 h-9 text-xs"
            />
          </div>
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-secondary text-foreground hover:bg-secondary/80 transition disabled:opacity-50 flex items-center gap-1.5"
            title="Buscar nuevos animes ahora"
          >
            {refreshing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "🔄"}
            {refreshing ? "Refrescando…" : "Refrescar"}
          </button>
        </div>
      </div>


      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando animes en emisión…
        </div>
      )}

      {!loading && filteredGroups.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          {showHidden ? "No hay animes ocultos." : showApproved ? "Aún no has aprobado ningún anime." : "🎉 No hay animes pendientes."}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredGroups.map((g) => {
          const onChanged = () => {
            refetchApproved();
            refetchHidden();
            qc.invalidateQueries({ queryKey: ["approved-anime-ids"] });
            qc.invalidateQueries({ queryKey: ["approval-videocache-ids"] });
            qc.invalidateQueries({ queryKey: ["hidden-pending-animes"] });
          };
          return (
            <div key={g.main.id} className="flex flex-col gap-2">
              {g.showMain && (
                <PendingCard
                  anime={g.main}
                  approved={approvedSet.has(g.main.id)}
                  hasVideo={withVideo?.has(g.main.id) ?? false}
                  hidden={hiddenSet.has(g.main.id)}
                  cascadeIds={g.related.map((r) => r.id)}
                  onChanged={onChanged}
                />
              )}

              {g.related.length > 0 && (
                <RelatedGroup
                  parentTitle={titleOf(g.main)}
                  related={g.related}
                  approvedSet={approvedSet}
                  hiddenSet={hiddenSet}
                  withVideo={withVideo}
                  onChanged={onChanged}
                  defaultOpen={!g.showMain}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RelatedGroup({
  parentTitle,
  related,
  approvedSet,
  hiddenSet,
  withVideo,
  onChanged,
}: {
  parentTitle: string;
  related: AiringItem[];
  approvedSet: Set<number>;
  hiddenSet: Set<number>;
  withVideo?: Set<number>;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-4 border-l-2 border-primary/40 pl-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 w-full text-left text-[11px] font-bold text-primary hover:text-primary/80 py-1"
      >
        <GitBranch className="w-3 h-3" />
        <ChevronDown className={`w-3 h-3 transition ${open ? "rotate-0" : "-rotate-90"}`} />
        {related.length} temporada{related.length > 1 ? "s" : ""} relacionada{related.length > 1 ? "s" : ""} de {parentTitle}
      </button>
      {open && (
        <div className="flex flex-col gap-2 mt-2">
          {related.map((r) => (
            <PendingCard
              key={r.id}
              anime={r}
              approved={approvedSet.has(r.id)}
              hasVideo={withVideo?.has(r.id) ?? false}
              hidden={hiddenSet.has(r.id)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendingCard({
  anime,
  approved,
  hasVideo,
  hidden,
  cascadeIds = [],
  onChanged,
}: {
  anime: AiringItem;
  approved: boolean;
  hasVideo: boolean;
  hidden: boolean;
  cascadeIds?: number[];
  onChanged: () => void;
}) {

  const navigate = useNavigate();
  const [lang, setLang] = useState<"sub" | "latino">("sub");
  const [seekeUrl, setSeekeUrl] = useState("");
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const title = titleOf(anime);
  const cover = anime.coverImage?.large || anime.coverImage?.extraLarge;
  const slug = slugFromTitle(anime.title?.romaji || title);

  // Al cambiar de idioma, precarga el enlace Seeke ya guardado para ese idioma (si existe)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await getCachedVideo(slug, 0, lang, anime.id);
      if (cancelled) return;
      const url = cached?.sources?.seeke?.[0] || null;
      setExistingUrl(url);
      setSeekeUrl(url || "");
    })();
    return () => { cancelled = true; };
  }, [lang, anime.id, slug]);

  const openAdvanced = () => {
    try {
      sessionStorage.setItem("admin:preselect-anime", JSON.stringify({
        id: anime.id,
        title,
        cover: cover || "",
        episodes: anime.episodes || 24,
        lang,
      }));
    } catch {}
    navigate("/admin?tab=videos");
  };

  const persistLink = async (url: string) => {
    if (url && url !== existingUrl) {
      const save = await saveCachedVideo({
        slug,
        episode: 0,
        lang,
        sources: { seeke: [url] },
        anilist_id: anime.id,
        anime_title: title,
      });
      if (!save.success) throw new Error(save.error || "No se pudo guardar el enlace");
      setExistingUrl(url);
    }
  };

  const handleSaveOnly = async () => {
    const url = seekeUrl.trim();
    if (!url) {
      toast.error(`Pega el enlace Seeke (${lang}) antes de guardar`);
      return;
    }
    if (url === existingUrl) {
      toast.info("Ese enlace ya está guardado");
      return;
    }
    setBusy(true);
    try {
      await persistLink(url);
      await logAdminActivity({
        area: "videos",
        action: "save_anime_link",
        summary: `Enlace ${lang} guardado (sin aprobar): ${title}`,
        target_type: "anime",
        target_id: String(anime.id),
        anilist_id: anime.id,
        anime_title: title,
        metadata: { seeke: url, lang, approved: false },
      });
      toast.success(`Enlace ${lang} guardado (pendiente de aprobar)`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async () => {
    const url = seekeUrl.trim();
    // Se puede aprobar sin nuevo URL si ya hay uno existente para este idioma
    if (!url && !existingUrl) {
      toast.error(`Pega el enlace Seeke (${lang}) antes de aprobar`);
      return;
    }
    setBusy(true);
    try {
      await persistLink(url);
      if (!approved) {
        const res = await approveAnime(anime.id, url || null as any);
        if (!res.success) throw new Error(res.error || "No se pudo aprobar");
        // Registrar automáticamente en el tracker de descargas como "completed"
        try {
          await supabase.from("anime_download_tracker").upsert({
            anilist_id: anime.id,
            title,
            cover_image: cover || null,
            total_episodes: anime.episodes || 0,
            status: "completed",
            airing_status: anime.status || null,
            updated_at: new Date().toISOString(),
          } as any, { onConflict: "anilist_id" });
        } catch (err) {
          console.warn("[approve] tracker upsert failed", err);
        }
        // Si el anime estaba oculto del Home, se desoculta automáticamente al aprobar
        try { await unhideAnime(anime.id); } catch {}
      }
      await logAdminActivity({
        area: "videos",
        action: approved ? "update_anime_link" : "approve_anime",
        summary: approved ? `Enlace ${lang} actualizado: ${title}` : `Aprobado: ${title}`,
        target_type: "anime",
        target_id: String(anime.id),
        anilist_id: anime.id,
        anime_title: title,
        metadata: { seeke: url || null, lang },
      });
      toast.success(approved ? `Enlace ${lang} actualizado` : `Aprobado: ${title}`);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || "Error al aprobar");
    } finally {
      setBusy(false);
    }
  };


  return (
    <div className="relative rounded-2xl border border-border bg-card overflow-hidden flex">
      {/* Único botón: ocultar 7 días y eliminar del tracker */}
      <button
        onClick={async () => {
          const cascade = cascadeIds.length;
          const msg = cascade > 0
            ? `¿Ocultar "${title}" y sus ${cascade} temporada${cascade > 1 ? "s" : ""} relacionada${cascade > 1 ? "s" : ""} durante 7 días? También se eliminarán del tracker de descargas.`
            : `¿Ocultar "${title}" de la bandeja durante 7 días? También se eliminará del tracker de descargas.`;
          if (!confirm(msg)) return;
          setBusy(true);
          try {
            const allIds = [anime.id, ...cascadeIds];
            for (const id of allIds) {
              try {
                await hidePendingAnime(id, `oculto desde bandeja${id !== anime.id ? " (cascada)" : ""}`);
              } catch (err) {
                console.warn("[hide] failed", id, err);
              }
              try {
                const { data: trackerRow } = await supabase
                  .from("anime_download_tracker")
                  .select("id")
                  .eq("anilist_id", id)
                  .maybeSingle();
                if (trackerRow?.id) {
                  await supabase.rpc("delete_download_tracker", { _tracker_id: trackerRow.id });
                }
              } catch (err) {
                console.warn("[hide] tracker delete failed", id, err);
              }
            }
            await logAdminActivity({
              area: "videos",
              action: "hide_pending_anime",
              summary: cascade > 0
                ? `Ocultado 7 días + ${cascade} relacionadas + removidos del tracker: ${title}`
                : `Ocultado 7 días + removido del tracker: ${title}`,
              target_type: "anime",
              target_id: String(anime.id),
              anilist_id: anime.id,
              anime_title: title,
              metadata: { cascade_ids: cascadeIds },
            });
            toast.success(cascade > 0 ? `Oculto ${allIds.length} animes y tracker limpio` : "Oculto 7 días y removido del tracker");
            onChanged();
          } catch (e: any) {
            toast.error(e?.message || "Error al ocultar");
          } finally { setBusy(false); }
        }}
        disabled={busy}
        title={cascadeIds.length > 0 ? `Ocultar 7 días (padre + ${cascadeIds.length} hijas) y eliminar del tracker` : "Ocultar 7 días y eliminar del tracker"}
        className="absolute top-1.5 right-1.5 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur border border-border text-foreground flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground disabled:opacity-50 shadow-md"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      <div className="w-24 h-36 shrink-0 bg-secondary">
        {cover && <LazyImage src={cover} alt={title} className="w-full h-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0 p-3 flex flex-col gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-foreground line-clamp-2">{title}</h3>
          <p className="text-[10px] text-muted-foreground">
            ID {anime.id} · {anime.episodes ? `${anime.episodes} eps` : "eps ?"} ·{" "}
            {anime.averageScore ? `${anime.averageScore}%` : "sin score"}
          </p>
          <div className="flex flex-wrap gap-1 mt-1">
            {/* Etiqueta de tipo (película / serie / OVA / etc.) */}
            {anime.format && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1 ${
                isMovieFormat(anime.format)
                  ? "bg-purple-500/15 text-purple-400"
                  : "bg-blue-500/15 text-blue-400"
              }`}>
                {isMovieFormat(anime.format) ? <Film className="w-2.5 h-2.5" /> : <Tv className="w-2.5 h-2.5" />}
                {formatLabel(anime.format)}
              </span>
            )}
            {/* Etiqueta de estado (en emisión / finalizado / próximamente) */}
            {anime.status && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                anime.status === "RELEASING" ? "bg-primary/15 text-primary" :
                anime.status === "FINISHED" ? "bg-accent/20 text-accent-foreground" :
                anime.status === "NOT_YET_RELEASED" ? "bg-yellow-500/15 text-yellow-500" :
                "bg-secondary text-muted-foreground"
              }`}>
                {getStatusLabel(anime.status)}
              </span>
            )}
            {approved && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-500">
                APROBADO
              </span>
            )}
            {hasVideo && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                <Play className="w-2.5 h-2.5" /> con enlace
              </span>
            )}
            {existingUrl && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                {lang} guardado
              </span>
            )}
          </div>
        </div>

        {/* Switcher de idioma */}
        <div className="flex gap-1">
          {(["sub", "latino"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              disabled={busy}
              className={`px-2 py-1 rounded-md text-[10px] font-bold transition ${
                lang === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              {l === "sub" ? "🇯🇵 Sub" : "🌎 Latino"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            value={seekeUrl}
            onChange={(e) => setSeekeUrl(e.target.value)}
            placeholder={`URL Seeke ${lang} (sobrescribe el anterior)`}
            className="h-8 text-[11px]"
            disabled={busy}
          />
        </div>

        <div className="flex gap-2 mt-auto">
          <button
            onClick={handleApprove}
            disabled={busy || (!seekeUrl.trim() && !existingUrl)}
            className="flex-1 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {approved ? "Actualizar" : "Aprobar"}
          </button>
          {!approved && (
            <button
              onClick={handleSaveOnly}
              disabled={busy || !seekeUrl.trim() || seekeUrl.trim() === existingUrl}
              title="Guarda el enlace del idioma sin aprobar (útil para esperar el segundo idioma)"
              className="h-8 px-2 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center gap-1 hover:bg-muted disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Guardar
            </button>
          )}
          <button
            onClick={openAdvanced}
            disabled={busy}
            title="Abrir en Videos con este anime preseleccionado"
            className="h-8 px-2 rounded-lg bg-secondary text-foreground text-xs font-bold flex items-center justify-center gap-1 hover:bg-muted disabled:opacity-50"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Avanzado
          </button>
        </div>
      </div>
    </div>
  );
}

