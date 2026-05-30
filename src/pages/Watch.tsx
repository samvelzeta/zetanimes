import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEpisodeServers, sortServersByPriority,
  markEpisodeWatched, getWatchedEpisodes, setWatchedEpisodes, titleToSlug, getCachedSlug,
  saveCachedSlug, getLatinoEpisode, getSeekeEpisode,
  clearSeekeEpisodeCache,
  type ZetServer,
} from "@/lib/zetapi";
import { resolveSlugMultiAPI } from "@/lib/slug-resolver";
import { getCachedVideo, cachedVideoToSources, getPlaybackPlatform, clearRuntimeVideoCache } from "@/lib/video-cache";
import { resolveSeekeBaseForEpisode, getLatestEpisodeByLang, listBlocks } from "@/lib/video-blocks";
import { getAnimeById, getTitle } from "@/lib/anilist";
import {
  Eye, EyeOff, ChevronLeft, Loader2, AlertCircle,
  Globe, Bug, ChevronDown, List,
} from "lucide-react";
import AdsterraBanner from "@/components/ads/AdsterraBanner";
import AdOverlayGate from "@/components/ads/AdOverlayGate";
import AnimePlayer from "@/components/video/AnimePlayer";
import StreamGuard from "@/components/video/StreamGuard";
import PlayerOverlay from "@/components/video/PlayerOverlay";
import ReportBrokenLink from "@/components/anime/ReportBrokenLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { useProfiles } from "@/contexts/ProfilesContext";
import { supabase } from "@/integrations/supabase/client";
import { isWebView, saveVideoProgress, getVideoProgress } from "@/lib/webview";
import { resolveEpisodeCount } from "@/lib/episode-count";

type Lang = "sub" | "latino";

type PlayerSourceItem = { name: string; embed: string; type?: string; episode?: number; lang: Lang; origin: "db" | "api" | "hls" | "seeke" };

const episodeCache = new Map<string, any>();
let didResetSeekeRuntimeCache = false;

function appendUniqueSource(list: PlayerSourceItem[], source: PlayerSourceItem) {
  if (!source.embed || list.some((item) => item.embed === source.embed)) return;
  list.push(source);
}

function sourcePriority(source: PlayerSourceItem) {
  const originOrder: Record<PlayerSourceItem["origin"], number> = { seeke: 0, db: 1, hls: 2, api: 3 };
  return originOrder[source.origin] ?? 9;
}

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const anilistId = Number(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const epParam = Number(searchParams.get("ep") || 1);
  const { user } = useAuth();
  const { permissions } = usePlanPermissions();
  const { activeProfile } = useProfiles();
  const profileId = activeProfile?.id ?? null;
  const watchedScope = user?.id && profileId ? `${user.id}:${profileId}` : null;
  const inWebView = isWebView();

  const [selectedEp, setSelectedEp] = useState(epParam);
  const [lang, setLang] = useState<Lang>("sub");
  const [showDebug, setShowDebug] = useState(false);
  const watchTimeRef = useRef(0);
  const lastTickTimeRef = useRef<number | null>(null);
  const queryClient = useQueryClient();
  const historyEntryIdRef = useRef<string | null>(null);
  const [initialTime, setInitialTime] = useState<number | undefined>(undefined);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [autoNextDone, setAutoNextDone] = useState<Set<string>>(() => new Set());
  const [playerSources, setPlayerSources] = useState<PlayerSourceItem[]>([]);
  const [playerEpisode, setPlayerEpisode] = useState(epParam);
  const lastSavedProgressRef = useRef(0);
  // Estado reactivo de episodios "vistos" para refrescar el ojito en tiempo real
  const [watchedSet, setWatchedSet] = useState<Set<string>>(() => new Set(getWatchedEpisodes(watchedScope)));

  useEffect(() => {
    if (didResetSeekeRuntimeCache) return;
    didResetSeekeRuntimeCache = true;
    episodeCache.clear();
    clearRuntimeVideoCache();
    clearSeekeEpisodeCache();
  }, []);

  useEffect(() => {
    setWatchedSet(new Set(getWatchedEpisodes(watchedScope)));
  }, [watchedScope]);

  // 🔄 Realtime: si el admin agrega/edita un Seeke u otro server cacheado
  // para ESTE anime, invalidamos cache local + queries para forzar que el
  // player se actualice y muestre Seeke en lugar del antiguo AV1.
  useEffect(() => {
    if (!anilistId) return;
    const channel = supabase
      .channel(`video-cache-${anilistId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_cache", filter: `anilist_id=eq.${anilistId}` },
        () => {
          episodeCache.clear();
          clearRuntimeVideoCache();
          clearSeekeEpisodeCache();
          queryClient.invalidateQueries({ queryKey: ["video-cache"] });
          queryClient.invalidateQueries({ queryKey: ["video-cache-opposite"] });
          queryClient.invalidateQueries({ queryKey: ["seeke-block"] });
          queryClient.invalidateQueries({ queryKey: ["seeke-blocks"] });
          queryClient.invalidateQueries({ queryKey: ["latest-ep"] });
          queryClient.invalidateQueries({ queryKey: ["zet-servers"] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "video_cache_blocks", filter: `anilist_id=eq.${anilistId}` },
        () => {
          episodeCache.clear();
          clearRuntimeVideoCache();
          clearSeekeEpisodeCache();
          queryClient.invalidateQueries({ queryKey: ["seeke-block"] });
          queryClient.invalidateQueries({ queryKey: ["seeke-blocks"] });
          queryClient.invalidateQueries({ queryKey: ["video-cache"] });
          queryClient.invalidateQueries({ queryKey: ["latest-ep"] });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [anilistId, queryClient]);


  useEffect(() => {
    historyEntryIdRef.current = null;
    watchTimeRef.current = 0;
    lastTickTimeRef.current = null;
    lastSavedProgressRef.current = 0;
  }, [user?.id, anilistId, selectedEp]);

  const { data: anilistData } = useQuery({
    queryKey: ["anime-detail", anilistId],
    queryFn: () => getAnimeById(anilistId),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 10,
  });

  const animeTitle = anilistData ? (anilistData.title?.romaji || anilistData.title?.english || "") : "";

  // Slug resolution with multiple title variants
  const { data: zetSlug, isLoading: loadingSlug } = useQuery({
    queryKey: ["zet-slug-multi", animeTitle, anilistId],
    queryFn: async () => {
      // 1. Manual override SIEMPRE gana (global para todos los usuarios)
      const { getSlugOverride } = await import("@/lib/slug-overrides");
      const override = await getSlugOverride(anilistId);
      if (override) {
        await saveCachedSlug(anilistId, override, animeTitle);
        return override;
      }

      // 2. Cache previo
      const cached = await getCachedSlug(anilistId);
      if (cached) return cached;

      // 3. Resolver multi-API
      if (anilistData?.title) {
        const slug = await resolveSlugMultiAPI(anilistData.title, anilistId);
        if (slug) {
          await saveCachedSlug(anilistId, slug, animeTitle);
          return slug;
        }
      }

      return titleToSlug(animeTitle);
    },
    enabled: !!animeTitle,
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  // Multi-source episode count: admin override > AniList episodes > nextAiringEpisode-1 > Jikan
  const { data: resolvedTotal = 0 } = useQuery({
    queryKey: ["ep-count", anilistId, anilistData?.episodes, anilistData?.nextAiringEpisode?.episode],
    queryFn: () => resolveEpisodeCount(anilistData, anilistId),
    enabled: !!anilistData && anilistId > 0,
    staleTime: 1000 * 60 * 30,
  });
  // Si está en emisión, NO caer al total planeado (anilistData.episodes) — usar solo lo resuelto (capítulos emitidos)
  const isReleasing = anilistData?.status === "RELEASING";
  const fallbackTotal = isReleasing
    ? (anilistData?.nextAiringEpisode?.episode ? anilistData.nextAiringEpisode.episode - 1 : 0)
    : (anilistData?.episodes || 0);
  const baseTotalEpisodes = resolvedTotal || fallbackTotal || 0;

  const cacheKey = `${zetSlug}-${selectedEp}-${lang}`;

  const playbackPlatform = getPlaybackPlatform();

  // Latino HLS check
  const { data: latinoEp } = useQuery({
    queryKey: ["latino-ep", zetSlug, selectedEp],
    queryFn: () => getLatinoEpisode(zetSlug!, selectedEp),
    enabled: !!zetSlug,
    staleTime: 1000 * 60 * 5,
  });

  // 1) Cache global (DB) - PRIORIDAD MÁXIMA: lo guardado en admin manda
  const { data: cachedVideo, isFetched: cachedVideoFetched } = useQuery({
    queryKey: ["video-cache", zetSlug, selectedEp, lang],
    queryFn: () => getCachedVideo(zetSlug || animeTitle || String(anilistId), selectedEp, lang, anilistId),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 5,
  });

  // 1b) Cache global del IDIOMA OPUESTO — para completar el toggle cuando
  // la API solo trae 1 idioma (típicamente JP). Si el admin guardó manualmente
  // el otro idioma en DB, lo combinamos para que el botón "Cambiar idioma" funcione.
  const oppositeLang: Lang = lang === "sub" ? "latino" : "sub";
  const { data: cachedVideoOpposite, isFetched: cachedVideoOppositeFetched } = useQuery({
    queryKey: ["video-cache-opposite", zetSlug, selectedEp, oppositeLang],
    queryFn: () => getCachedVideo(zetSlug || animeTitle || String(anilistId), selectedEp, oppositeLang, anilistId),
    enabled: anilistId > 0 && !!zetSlug,
    staleTime: 1000 * 60 * 5,
  });

  const hasCurrentSeekeBase = (cachedVideo?.sources?.seeke?.length || 0) > 0;
  const hasOppositeSeekeBase = (cachedVideoOpposite?.sources?.seeke?.length || 0) > 0;

  // Bloques: si están definidos, sobreescriben la URL madre única para el ep actual.
  const { data: currentBlock } = useQuery({
    queryKey: ["seeke-block", anilistId, lang, selectedEp],
    queryFn: () => resolveSeekeBaseForEpisode(anilistId, lang, selectedEp),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 5,
  });
  const { data: oppositeBlock } = useQuery({
    queryKey: ["seeke-block", anilistId, oppositeLang, selectedEp],
    queryFn: () => resolveSeekeBaseForEpisode(anilistId, oppositeLang, selectedEp),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 5,
  });
  const { data: currentBlocks = [], isFetched: currentBlocksFetched } = useQuery({
    queryKey: ["seeke-blocks", anilistId, lang],
    queryFn: () => listBlocks(anilistId, lang),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 5,
  });
  const { data: oppositeBlocks = [], isFetched: oppositeBlocksFetched } = useQuery({
    queryKey: ["seeke-blocks", anilistId, oppositeLang],
    queryFn: () => listBlocks(anilistId, oppositeLang),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 5,
  });

  // latest_episode por idioma (combina bloques + URL única).
  const currentSeekeBase = cachedVideo?.sources?.seeke?.[0];
  const oppositeSeekeBase = cachedVideoOpposite?.sources?.seeke?.[0];
  const hasCurrentSeekeConfig = !!currentSeekeBase || currentBlocks.length > 0;
  const hasOppositeSeekeConfig = !!oppositeSeekeBase || oppositeBlocks.length > 0;
  const hasAnySeekeConfig = hasCurrentSeekeConfig || hasOppositeSeekeConfig;
  const seekeConfigReady = currentBlocksFetched && oppositeBlocksFetched;
  const currentSeekeAvailableForEpisode = !!currentSeekeBase || !!currentBlock;
  const oppositeSeekeAvailableForEpisode = !!oppositeSeekeBase || !!oppositeBlock;
  const { data: latestCurrent, isFetched: latestCurrentFetched } = useQuery({
    queryKey: ["latest-ep", anilistId, lang, currentSeekeBase],
    queryFn: () => getLatestEpisodeByLang(anilistId, lang, currentSeekeBase),
    enabled: anilistId > 0 && hasCurrentSeekeConfig,
    staleTime: 1000 * 60 * 10,
  });
  const { data: latestOpposite, isFetched: latestOppositeFetched } = useQuery({
    queryKey: ["latest-ep", anilistId, oppositeLang, oppositeSeekeBase],
    queryFn: () => getLatestEpisodeByLang(anilistId, oppositeLang, oppositeSeekeBase),
    enabled: anilistId > 0 && hasOppositeSeekeConfig,
    staleTime: 1000 * 60 * 10,
  });
  // 2) Episode servers fallback. Si existe cualquier configuración Seeke para
  // este anime, NO se consulta AV1/Zilla: Seeke manda o se bloquea el episodio.
  const { data: serverData, isLoading: loadingServers, error: serverError } = useQuery({
    queryKey: ["zet-servers", zetSlug, selectedEp, lang],
    queryFn: async () => {
      if (episodeCache.has(cacheKey)) return episodeCache.get(cacheKey);
      const res = await getEpisodeServers(zetSlug!, selectedEp, lang);
      episodeCache.set(cacheKey, res);
      return res;
    },
    enabled: !!zetSlug && cachedVideoFetched && seekeConfigReady && !hasAnySeekeConfig,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Latest_episode dinámico:
  // REGLA: si hay AL MENOS un servidor Seeke (URL madre o bloque) en CUALQUIER idioma,
  // la VPS manda — `latest_episode` define cuántos botones se muestran. NUNCA se
  // reconstruye el player con un capítulo viejo (p.ej. 1) cuando AniList dice
  // que hay más capítulos de los que realmente existen en Seeke.
  // Si no hay nada de Seeke en ningún idioma, recurrimos al techo de AniList/API.
  const latestForCurrentLang = latestCurrent ?? 0;
  const latestReady = (!hasCurrentSeekeConfig || latestCurrentFetched) && (!hasOppositeSeekeConfig || latestOppositeFetched);
  const hasSeekeForCurrentLang = hasCurrentSeekeConfig;
  const seekeMax = Math.max(latestCurrent || 0, latestOpposite || 0);
  const totalEpisodes = hasAnySeekeConfig ? seekeMax : baseTotalEpisodes;
  // Tope efectivo de navegación según el idioma actual:
  // - Con Seeke en idioma actual → estricto a su latest_episode.
  // - Sin Seeke en idioma actual pero con Seeke en el opuesto → usar el opuesto.
  // - Sin Seeke en ningún idioma → cae a AniList/API.
  const av1Max = baseTotalEpisodes;
  const maxEpisodeForLang = hasSeekeForCurrentLang
    ? latestForCurrentLang
    : (hasAnySeekeConfig ? (latestOpposite || 0) : av1Max);
  const isEpisodeOutsideCurrentBlocks = hasCurrentSeekeConfig && !currentSeekeBase && currentBlocks.length > 0 && !currentBlock;
  const oppositeCanCoverSelected = oppositeSeekeAvailableForEpisode && (latestOpposite || 0) > 0 && selectedEp <= (latestOpposite || 0);
  const currentLangUnavailable = maxEpisodeForLang <= 0 || selectedEp > maxEpisodeForLang || isEpisodeOutsideCurrentBlocks;
  const isEpisodeBlocked = hasAnySeekeConfig && latestReady && currentLangUnavailable && !oppositeCanCoverSelected;
  // Si Seeke no cubre el ep actual, NO usamos su URL ni caemos a AV1.
  const seekeCoversCurrent = currentSeekeAvailableForEpisode && latestForCurrentLang > 0 && selectedEp <= latestForCurrentLang;
  const seekeCoversOpposite = oppositeSeekeAvailableForEpisode && (latestOpposite || 0) > 0 && selectedEp <= (latestOpposite || 0);
  // Sin padding con selectedEp: si el usuario pide un ep > tope, se bloquea arriba.
  const episodeNumbers = Array.from({ length: Math.max(totalEpisodes, 0) }, (_, i) => i + 1);

  const { data: oppositeServerData } = useQuery({
    queryKey: ["zet-servers-opposite", zetSlug, selectedEp, oppositeLang],
    queryFn: async () => {
      const oppositeKey = `${zetSlug}-${selectedEp}-${oppositeLang}`;
      if (episodeCache.has(oppositeKey)) return episodeCache.get(oppositeKey);
      const res = await getEpisodeServers(zetSlug!, selectedEp, oppositeLang);
      episodeCache.set(oppositeKey, res);
      return res;
    },
    enabled: !!zetSlug && cachedVideoOppositeFetched && seekeConfigReady && !hasAnySeekeConfig,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Construye fuentes híbridas por idioma: primero DB/manual, luego HLS Latino,
  // luego API. Dentro de cada fuente manual se respeta universal → PC/APK.
  const buildSources = useCallback((): PlayerSourceItem[] => {
    const sources: PlayerSourceItem[] = [];

    const addBlock = (block: typeof currentBlock, sourceLang: Lang) => {
      if (!block) return;
      const tag = sourceLang === "latino" ? "🌎 LAT" : "🇯🇵 JP";
      appendUniqueSource(sources, {
        name: `Bloque ${block.blockIndex}${block.blockLabel ? " · " + block.blockLabel : ""} • ${tag}`,
        embed: block.baseUrl,
        type: "seeke",
        episode: block.episodeWithinBlock,
        lang: sourceLang,
        origin: "seeke",
      });
    };

    const addDb = (cached: typeof cachedVideo, sourceLang: Lang, hasBlock: boolean) => {
      if (!cached) return;
      const tag = sourceLang === "latino" ? "🌎 LAT" : "🇯🇵 JP";
      cachedVideoToSources(cached).forEach((item) => {
        // Si hay bloque definido, NO usamos la URL madre única para seeke
        // (la del bloque manda y ya fue agregada antes).
        if (hasBlock && item.type === "seeke") return;
        appendUniqueSource(sources, {
          ...item,
          episode: selectedEp,
          name: `${item.name} • ${tag}`,
          lang: sourceLang,
          origin: item.type === "seeke" ? "seeke" : "db",
        });
      });
    };

    const addApi = (data: typeof serverData, sourceLang: Lang) => {
      const tag = sourceLang === "latino" ? "🌎 LAT" : "🇯🇵 JP";
      sortServersByPriority((data?.servers || []) as ZetServer[]).forEach((server, index) => {
        if (!server.embed) return;
        appendUniqueSource(sources, {
          name: `${server.name || `Servidor ${index + 1}`} • ${tag}`,
          embed: server.embed,
          lang: sourceLang,
          origin: "api",
        });
      });
    };

    // Si Seeke ya no cubre el episodio actual del idioma activo, NO usamos
    // bloque/DB-seeke (forzamos AV1). Esto evita capítulos fantasma reciclados.
    if (seekeCoversCurrent) {
      addBlock(currentBlock, lang);
      addDb(cachedVideo, lang, !!currentBlock);
    } else if (!hasAnySeekeConfig && cachedVideo) {
      // Solo añadimos fuentes NO-seeke del DB cache (HLS/MP4/embed manuales).
      addDb({ ...cachedVideo, sources: { ...cachedVideo.sources, seeke: [] } } as any, lang, true);
    }
    if (!hasAnySeekeConfig && lang === "latino") {
      (latinoEp?.sources?.hls || []).forEach((url, i) => appendUniqueSource(sources, {
        name: `HLS Latino ${i + 1} • 🌎 LAT`, embed: url, type: "hls", lang: "latino", origin: "hls",
      }));
    }
    addApi(serverData, lang);

    if (!hasAnySeekeConfig || seekeCoversOpposite) {
      addBlock(oppositeBlock, oppositeLang);
      addDb(cachedVideoOpposite, oppositeLang, !!oppositeBlock);
    }
    if (!hasAnySeekeConfig && oppositeLang === "latino") {
      (latinoEp?.sources?.hls || []).forEach((url, i) => appendUniqueSource(sources, {
        name: `HLS Latino ${i + 1} • 🌎 LAT`, embed: url, type: "hls", lang: "latino", origin: "hls",
      }));
    }
    addApi(oppositeServerData, oppositeLang);

    return sources.sort((a, b) => sourcePriority(a) - sourcePriority(b));
  }, [lang, latinoEp, serverData, cachedVideo, cachedVideoOpposite, oppositeLang, oppositeServerData, selectedEp, currentBlock, oppositeBlock, seekeCoversCurrent, seekeCoversOpposite, hasAnySeekeConfig]);

  const rawSources = useMemo(() => buildSources(), [buildSources]);
  // Embeds reales por idioma (después del dedup global de appendUniqueSource).
  // Si la API del idioma opuesto devolvió exactamente los mismos embeds que el
  // actual, NO los consideramos verdaderamente "del otro idioma".
  const langAvailability = rawSources.reduce<Record<Lang, number>>((acc, source) => {
    acc[source.lang] += 1;
    return acc;
  }, { sub: 0, latino: 0 });
  const dbLangAvailability = rawSources.reduce<Record<Lang, number>>((acc, source) => {
    if (source.origin === "db" || source.origin === "hls" || source.origin === "seeke") acc[source.lang] += 1;
    return acc;
  }, { sub: 0, latino: 0 });
  const apiLangAvailability = rawSources.reduce<Record<Lang, number>>((acc, source) => {
    if (source.origin === "api") acc[source.lang] += 1;
    return acc;
  }, { sub: 0, latino: 0 });
  const hasMultipleSources = rawSources.length >= 2;
  const dbLikeCount = rawSources.filter((source) => source.origin === "db" || source.origin === "hls" || source.origin === "seeke").length;
  const apiCount = rawSources.filter((source) => source.origin === "api").length;
  const hasDbBothLanguages = dbLangAvailability.sub > 0 && dbLangAvailability.latino > 0;
  const hasSeekeBothLanguages = rawSources.some((source) => source.origin === "seeke" && source.lang === "sub") && rawSources.some((source) => source.origin === "seeke" && source.lang === "latino");
  // Activar toggle de idioma también cuando solo hay Seeke en un idioma pero la
  // API (AV1/zetapi) trae servidores reales en el opuesto (embeds únicos, ya
  // filtrados por appendUniqueSource). Permite alternar JP (Seeke+AV1) ↔ LAT (AV1).
  const hasApiOnlyOppositeLang =
    (dbLangAvailability.sub > 0 && dbLangAvailability.latino === 0 && apiLangAvailability.latino > 0) ||
    (dbLangAvailability.latino > 0 && dbLangAvailability.sub === 0 && apiLangAvailability.sub > 0);
  const shouldShowLanguageControls = (hasDbBothLanguages && dbLikeCount > 0) || hasApiOnlyOppositeLang;
  const shouldShowServerControl = hasMultipleSources && !shouldShowLanguageControls && !hasSeekeBothLanguages;
  const sortedSources = useMemo(() => {
    if (shouldShowLanguageControls) {
      // Cuando hay DB-like en el idioma actual, priorízalo. Si solo hay API en
      // ese idioma (caso AV1-LAT cuando Seeke solo trae JP), prioriza cualquier
      // fuente de ese idioma.
      const hasDbLikeForLang = dbLangAvailability[lang] > 0;
      return [...rawSources].sort((a, b) => {
        const aMatch = a.lang === lang && (hasDbLikeForLang ? (a.origin === "db" || a.origin === "hls" || a.origin === "seeke") : true);
        const bMatch = b.lang === lang && (hasDbLikeForLang ? (b.origin === "db" || b.origin === "hls" || b.origin === "seeke") : true);
        const aRank = aMatch ? 0 : 1;
        const bRank = bMatch ? 0 : 1;
        return aRank - bRank || sourcePriority(a) - sourcePriority(b);
      });
    }
    return activeSourceIdx > 0 && activeSourceIdx < rawSources.length
      ? [rawSources[activeSourceIdx], ...rawSources.filter((_, i) => i !== activeSourceIdx)]
      : rawSources;
  }, [activeSourceIdx, rawSources, shouldShowLanguageControls, lang, dbLangAvailability]);
  const activeLang = sortedSources[0]?.lang || lang;
  // Subtítulos softsub vienen del API (modo japonés). Usar el del idioma activo.
  const activeSubtitles = useMemo(() => {
    const src = activeLang === lang ? serverData : oppositeServerData;
    const subs = (src as any)?.subtitles;
    return Array.isArray(subs) ? subs : [];
  }, [serverData, oppositeServerData, activeLang, lang]);
  const autoNextKey = `${anilistId}-${selectedEp}`;

  // Restore progress on episode change
  useEffect(() => {
    if (zetSlug) {
      const saved = getVideoProgress(zetSlug, selectedEp);
      if (saved && saved.currentTime > 5) {
        setInitialTime(saved.currentTime);
      } else {
        setInitialTime(undefined);
      }
    }
  }, [zetSlug, selectedEp]);

  // Use replace instead of push for episode navigation (fixes back button)
  const selectEpisode = (epNumber: number) => {
    setSelectedEp(epNumber);
    setActiveSourceIdx(0);
    navigate(`/watch/${id}?ep=${epNumber}`, { replace: true });
    watchTimeRef.current = 0;
    if (!inWebView) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleAutoNext = useCallback(() => {
    const autoPlayEnabled = localStorage.getItem("zet_autoplay") !== "false";
    if (!autoPlayEnabled || selectedEp >= (maxEpisodeForLang || 0) || autoNextDone.has(autoNextKey)) return;
    setAutoNextDone((prev) => {
      const next = new Set(prev);
      next.add(autoNextKey);
      return next;
    });
    selectEpisode(selectedEp + 1);
  }, [autoNextDone, autoNextKey, selectedEp, maxEpisodeForLang]);

  // Si el idioma activo no tiene ese episodio en Seeke pero el otro sí, cambiar
  // automáticamente para no caer en players AV1 ni mostrar un capítulo fantasma.
  useEffect(() => {
    if (!hasAnySeekeConfig || !latestReady || !oppositeCanCoverSelected) return;
    if (currentLangUnavailable || !currentSeekeAvailableForEpisode) {
      setLang(oppositeLang);
      setActiveSourceIdx(0);
    }
  }, [hasAnySeekeConfig, latestReady, oppositeCanCoverSelected, currentLangUnavailable, currentSeekeAvailableForEpisode, oppositeLang]);

  // Helper: marca el episodio como visto en estado + localStorage (sólo logueado)
  const markWatchedReactive = useCallback((epSlug: string) => {
    if (!user) return; // sólo registrados
    if (watchedSet.has(epSlug)) return;
    markEpisodeWatched(epSlug, watchedScope);
    setWatchedSet((prev) => {
      const next = new Set(prev);
      next.add(epSlug);
      return next;
    });
  }, [user, watchedSet, watchedScope]);

  const getHistoryBase = useCallback(() => {
    if (!user || !anilistData) return null;
    const cover = anilistData?.coverImage?.extraLarge || anilistData?.coverImage?.large || "";
    const title = getTitle(anilistData);

    return {
      user_id: user.id,
      profile_id: profileId,
      anime_id: anilistId,
      episode_number: selectedEp,
      anime_title: title,
      anime_cover: cover,
    };
  }, [user, anilistData, anilistId, selectedEp, profileId]);

  const ensureHistoryEntry = useCallback(async () => {
    const base = getHistoryBase();
    if (!base) return null;

    if (historyEntryIdRef.current) return historyEntryIdRef.current;

    let historyQuery = supabase
      .from("watch_history")
      .select("id")
      .eq("user_id", base.user_id)
      .eq("anime_id", base.anime_id)
      .eq("episode_number", base.episode_number)
      .order("created_at", { ascending: false })
      .limit(1);
    historyQuery = base.profile_id ? historyQuery.eq("profile_id", base.profile_id) : historyQuery.is("profile_id", null);
    const { data: existing, error: readError } = await historyQuery.maybeSingle();

    if (readError) {
      console.error("[watch_history] no pude consultar historial", readError);
      return null;
    }

    if (existing?.id) {
      historyEntryIdRef.current = existing.id;
      return existing.id;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("watch_history")
      .insert({
        ...base,
        completed: false,
        watch_duration_seconds: 0,
        current_time_seconds: 0,
        total_duration_seconds: 0,
        progress_percent: 0,
        created_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();

    if (insertError) {
      console.error("[watch_history] no pude crear historial", insertError);
      return null;
    }

    historyEntryIdRef.current = inserted.id;
    return inserted.id;
  }, [getHistoryBase]);

  // Helper compartido: persiste el progreso a watch_history
  const persistProgress = useCallback(
    async (currentTime: number, totalDuration: number, isCompleted: boolean) => {
      const base = getHistoryBase();
      if (!base) return;

      const entryId = await ensureHistoryEntry();
      if (!entryId) return;

      const safeCurrentTime = Math.max(0, Math.round(currentTime));
      const safeTotalDuration = Math.max(0, Math.round(totalDuration));
      const progressPct = safeTotalDuration > 0
        ? Math.min(100, Math.round((safeCurrentTime / safeTotalDuration) * 100))
        : 0;

      const { error } = await supabase
        .from("watch_history")
        .update({
          ...base,
          completed: isCompleted,
          watch_duration_seconds: Math.max(Math.round(watchTimeRef.current), safeCurrentTime),
          current_time_seconds: safeCurrentTime,
          total_duration_seconds: safeTotalDuration,
          progress_percent: progressPct,
          created_at: new Date().toISOString(),
        } as any)
        .eq("id", entryId);

      if (error) {
        console.error("[watch_history] no pude actualizar progreso", error);
      }
    },
    [ensureHistoryEntry, getHistoryBase]
  );

  const handleProgress = useCallback((pct: number) => {
    const video = document.querySelector("video") as HTMLVideoElement | null;
    const currentTime = video?.currentTime || 0;

    // Sumar SOLO el tiempo real transcurrido en el video, no por número de ticks.
    // timeupdate dispara 4-60 veces/seg, así que `+=1` daba conteos exagerados.
    const last = lastTickTimeRef.current;
    if (last !== null) {
      const delta = currentTime - last;
      // Ignorar seeks (delta grande) o retrocesos.
      if (delta > 0 && delta < 2) {
        watchTimeRef.current += delta;
      }
    }
    lastTickTimeRef.current = currentTime;

    // Guardar progreso aprox. cada 5s reales.
    if (zetSlug && video && video.duration > 0) {
      const sinceLastSave = Math.abs(pct - lastSavedProgressRef.current);
      if (sinceLastSave >= 0.02 || watchTimeRef.current - (lastTickTimeRef as any)._lastSave > 5) {
        saveVideoProgress(zetSlug, selectedEp, currentTime, video.duration);
        persistProgress(currentTime, video.duration, pct >= 0.7);
        lastSavedProgressRef.current = pct;
        (lastTickTimeRef as any)._lastSave = watchTimeRef.current;
      }
    }

    if (pct >= 0.7 && zetSlug) {
      const epSlug = `${zetSlug}-${selectedEp}`;
      markWatchedReactive(epSlug);
    }

  }, [zetSlug, selectedEp, persistProgress, markWatchedReactive]);

  // Guarda inmediatamente al hacer seek manual (adelantar / retroceder)
  const handleSeeked = useCallback((currentTime: number, duration: number) => {
    if (!zetSlug || !duration) return;
    saveVideoProgress(zetSlug, selectedEp, currentTime, duration);
    const pct = currentTime / duration;
    persistProgress(currentTime, duration, pct >= 0.7);
    lastSavedProgressRef.current = pct;
  }, [zetSlug, selectedEp, persistProgress]);

  // ===== Tracking estimado para EMBEDS (iframe sin acceso a timeupdate) =====
  // Asume duración estándar 24min (1440s). Cada 10s incrementa y guarda.
  useEffect(() => {
    if (!zetSlug || !anilistData) return;
    // Detectar si la fuente activa es un embed
    const active = sortedSources[0];
    if (!active) return;
    const url = active.embed || "";
    const isEmbed = active.type !== "hls" && !url.includes(".m3u8") && !url.includes(".mp4");
    if (!isEmbed) return;

    const ESTIMATED_DURATION = 1440; // 24min
    let elapsed = 0;
    const tick = 10; // segundos
    const interval = setInterval(() => {
      elapsed += tick;
      watchTimeRef.current += tick;
      const pct = elapsed / ESTIMATED_DURATION;
      const isCompleted = pct >= 0.7;
      persistProgress(elapsed, ESTIMATED_DURATION, isCompleted);
      if (isCompleted && zetSlug) {
        markWatchedReactive(`${zetSlug}-${selectedEp}`);
      }
      if (elapsed >= ESTIMATED_DURATION) {
        clearInterval(interval);
      }
    }, tick * 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zetSlug, selectedEp, sortedSources[0]?.embed, anilistData, user]);

  // Crear / refrescar entrada inmediatamente para que aparezca en Recientes
  useEffect(() => {
    if (!zetSlug || !user || !anilistData) return;

    const refreshHistoryEntry = async () => {
      const base = getHistoryBase();
      const entryId = await ensureHistoryEntry();
      if (!base || !entryId) return;

      await supabase
        .from("watch_history")
        .update({
          ...base,
          created_at: new Date().toISOString(),
        } as any)
        .eq("id", entryId);
    };

    refreshHistoryEntry();
  }, [zetSlug, selectedEp, anilistData, user, getHistoryBase, ensureHistoryEntry]);

  const toggleWatched = (epNum: number) => {
    if (!zetSlug || !user) return; // requerido login
    const epSlug = `${zetSlug}-${epNum}`;
    if (watchedSet.has(epSlug)) {
      // Desmarcar
      const all = getWatchedEpisodes(watchedScope).filter((s) => s !== epSlug);
      setWatchedEpisodes(all, watchedScope);
      setWatchedSet(new Set(all));
    } else {
      markWatchedReactive(epSlug);
    }
  };

  const displayTitle = anilistData ? getTitle(anilistData) : "Cargando...";
  const isSeekeLatestLoading = hasAnySeekeConfig && !latestReady;
  const isLoading = loadingSlug || !cachedVideoFetched || !cachedVideoOppositeFetched || !seekeConfigReady || loadingServers || isSeekeLatestLoading;
  // IMPORTANT: keep previous playerSources mounted while loading the next episode
  // so the iframe DOM node (and thus fullscreen state) is preserved.
  const displayedSources = !isLoading && sortedSources.length > 0 ? sortedSources : playerSources;
  const displayedEpisode = !isLoading && sortedSources.length > 0 ? selectedEp : playerEpisode;
  const displayedAutoNextKey = `${anilistId}-${displayedEpisode}`;
  const isEpisodeSwitching = isLoading && playerSources.length > 0;

  useEffect(() => {
    if (sortedSources.length === 0 || isLoading) return;
    setPlayerSources(sortedSources);
    setPlayerEpisode(selectedEp);
  }, [sortedSources, isLoading, selectedEp]);

  // Tuerca decorativa SVG (estática, mitad visible en esquina)
  const CornerNut = ({ className }: { className: string }) => (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <defs>
        <radialGradient id="cornerNutBg" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="hsl(20 25% 18%)" />
          <stop offset="100%" stopColor="hsl(15 40% 5%)" />
        </radialGradient>
      </defs>
      <polygon
        points="50,4 91,27 91,73 50,96 9,73 9,27"
        fill="url(#cornerNutBg)"
        stroke="hsl(22 60% 35%)"
        strokeWidth="2.5"
      />
      <polygon
        points="50,12 84,30 84,70 50,88 16,70 16,30"
        fill="none"
        stroke="hsl(22 40% 22%)"
        strokeWidth="0.8"
      />
      <circle cx="50" cy="50" r="14" fill="hsl(15 35% 6%)" stroke="hsl(22 45% 25%)" strokeWidth="1.2" />
    </svg>
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Player con marco decorativo (brillo naranja + tuercas en las 4 esquinas) */}
      <div className="px-4 pt-4 mb-3">
        <div className="relative">
          {/* Tuercas DEBAJO del player (z-0), solo sobresale la mitad */}
          <CornerNut className="absolute -top-3 -left-3 w-9 h-9 sm:w-11 sm:h-11 z-0 pointer-events-none drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
          <CornerNut className="absolute -top-3 -right-3 w-9 h-9 sm:w-11 sm:h-11 z-0 pointer-events-none drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
          <CornerNut className="absolute -bottom-3 -left-3 w-9 h-9 sm:w-11 sm:h-11 z-0 pointer-events-none drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />
          <CornerNut className="absolute -bottom-3 -right-3 w-9 h-9 sm:w-11 sm:h-11 z-0 pointer-events-none drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]" />

          {/* Wrapper del player con borde + brillo naranja, encima de las tuercas */}
          <div
            ref={playerWrapperRef}
            className="relative z-10 rounded-xl overflow-hidden border-2 border-primary/40"
            style={{
              boxShadow:
                "0 0 0 1px hsl(var(--primary) / 0.15), 0 0 22px hsl(var(--primary) / 0.45), 0 0 50px hsl(var(--primary) / 0.25)",
            }}
          >
          {isEpisodeBlocked ? (
            <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3 px-4 text-center">
              <AlertCircle className="w-10 h-10 text-primary" />
              <p className="text-sm font-bold text-foreground">Episodio aún no disponible</p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                El episodio {selectedEp} todavía no se ha emitido o cargado para este idioma. Último disponible: <span className="text-primary font-bold">EP {maxEpisodeForLang}</span>.
              </p>
            </div>
          ) : isLoading && playerSources.length === 0 ? (
            <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : displayedSources.length > 0 ? (
            <StreamGuard animeId={anilistId} episode={selectedEp}>
              <AnimePlayer
                sources={displayedSources}
                title={`${displayTitle} - EP ${displayedEpisode}`}
                onProgress={isEpisodeSwitching ? undefined : handleProgress}
                onSeeked={isEpisodeSwitching ? undefined : handleSeeked}
                initialTime={initialTime}
                showServerPicker={shouldShowServerControl}
                episodeKey={displayedAutoNextKey}
                canPrev={displayedEpisode > 1}
                canNext={displayedEpisode < maxEpisodeForLang}
                onPrev={() => selectedEp > 1 && selectEpisode(selectedEp - 1)}
                onNext={() => selectedEp < maxEpisodeForLang && selectEpisode(selectedEp + 1)}
                onAutoNext={isEpisodeSwitching ? undefined : handleAutoNext}
                autoNextAlreadyTriggered={autoNextDone.has(displayedAutoNextKey)}
                currentEpisode={displayedEpisode}
                totalEpisodes={totalEpisodes}
                onSelectEpisode={(n) => selectEpisode(n)}
                subtitles={activeSubtitles}
              />
              {isEpisodeSwitching && (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/45 backdrop-blur-[2px]">
                  <div className="flex items-center gap-3 rounded-lg border border-primary/35 bg-background/90 px-4 py-3 shadow-[0_0_28px_hsl(var(--primary)/0.35)]">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm font-bold text-foreground">Cargando EP {selectedEp}</span>
                  </div>
                </div>
              )}
              <PlayerOverlay
                episode={displayedEpisode}
                totalEpisodes={totalEpisodes}
                onPrev={() => selectedEp > 1 && selectEpisode(selectedEp - 1)}
                onNext={() => selectedEp < maxEpisodeForLang && selectEpisode(selectedEp + 1)}
                containerRef={playerWrapperRef}
              />
              <AdOverlayGate
                episodeKey={`${anilistId}-${selectedEp}`}
                everyN={1}
                countdownSecs={5}
              />
            </StreamGuard>
          ) : (
            <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground text-center px-4">
                {serverError ? "Error al cargar servidores." : !zetSlug ? "Buscando anime..." : "No hay servidores disponibles"}
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Title + controls */}
      <div className="px-5 sm:px-6 mt-8 mb-4">
        <h1 className="font-steam text-lg sm:text-xl font-bold text-foreground mb-1 leading-tight">
          {displayTitle}
        </h1>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Episodio {selectedEp} {zetSlug && `• ${zetSlug}`}
            {inWebView && " • 📱 APK"}
          </p>
          <Link
            to={`/anime/${id}`}
            className="group inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/40 hover:border-primary text-primary font-steam text-xs font-bold tracking-wide transition-all active:scale-95 shadow-[0_0_12px_hsl(var(--primary)/0.25)] hover:shadow-[0_0_18px_hsl(var(--primary)/0.5)]"
          >
            <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
            Volver al anime
          </Link>
        </div>

        {/* Idioma / fuente alternativa */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          {shouldShowLanguageControls && (["sub", "latino"] as const).map((targetLang) => {
            const enabled = langAvailability[targetLang] > 0;
            const selected = activeLang === targetLang;
            return (
              <button
                key={targetLang}
                disabled={!enabled}
                onClick={() => {
                  if (!enabled) return;
                  setLang(targetLang);
                  setActiveSourceIdx(0);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all flex items-center gap-1.5 disabled:opacity-35 disabled:cursor-not-allowed ${
                  selected ? "bg-primary text-primary-foreground border-primary" : "bg-primary/15 border-primary/40 text-primary hover:bg-primary/25"
                }`}
              >
                {targetLang === "sub" ? "🇯🇵 Japonés" : "🌎 Latino"}
                <span className="text-[10px] opacity-80">{langAvailability[targetLang]}</span>
              </button>
            );
          })}
          {shouldShowServerControl && (
            <button
              onClick={() => setActiveSourceIdx((i) => (i + 1) % Math.max(1, rawSources.length))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border text-foreground hover:border-primary hover:text-primary transition-all"
            >
              Servidor: {Math.min(activeSourceIdx + 1, rawSources.length)}/{rawSources.length}
            </button>
          )}
          {!shouldShowServerControl && !shouldShowLanguageControls && <span className="text-[10px] text-muted-foreground">Fuente directa disponible</span>}
        </div>

        {lang === "latino" && latinoEp && (
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-xl px-4 py-2 mb-4">
            <span className="text-xs text-primary font-medium">✓ HLS Latino disponible</span>
          </div>
        )}

        {serverError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{(serverError as Error)?.message || "Error al obtener servidores"}</p>
          </div>
        )}

        {sortedSources.length > 0 && (
          <p className="text-[10px] text-muted-foreground mb-2">
            {sortedSources.length} servidor{sortedSources.length > 1 ? "es" : ""} disponible{sortedSources.length > 1 ? "s" : ""}
          </p>
        )}

        {zetSlug && anilistData && (
          <div className="mb-3">
            <ReportBrokenLink
              slug={zetSlug}
              episodeNumber={selectedEp}
              animeTitle={displayTitle}
              animeCover={anilistData.coverImage?.large || anilistData.coverImage?.extraLarge || ""}
              anilistId={anilistId}
            />
          </div>
        )}

        <button onClick={() => setShowDebug(!showDebug)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition mb-2">
          <Bug className="w-3.5 h-3.5" /> Debug
          <ChevronDown className={`w-3 h-3 transition-transform ${showDebug ? "rotate-180" : ""}`} />
        </button>
        {showDebug && (
          <div className="bg-secondary/50 border border-border rounded-xl p-3 mb-4 text-[10px] font-mono space-y-1">
            <p><span className="text-primary">slug:</span> {zetSlug || "—"}</p>
            <p><span className="text-primary">episode:</span> {selectedEp}</p>
            <p><span className="text-primary">lang:</span> {lang}</p>
            <p><span className="text-primary">servers:</span> {sortedSources.length}</p>
            <p><span className="text-primary">idiomas:</span> JP {langAvailability.sub} · LAT {langAvailability.latino}</p>
            <p><span className="text-primary">plataforma:</span> {playbackPlatform === "mobile" ? "APK/Móvil" : "PC"}</p>
            <p><span className="text-primary">latino_hls:</span> {latinoEp ? "✓" : "✗"}</p>
            <p><span className="text-primary">webview:</span> {inWebView ? "✓" : "✗"}</p>
            <p><span className="text-primary">titles:</span> {[anilistData?.title?.romaji, anilistData?.title?.english].filter(Boolean).join(", ")}</p>
          </div>
        )}
      </div>

      {/* Navegación de episodios — naranja translúcido alargado */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectedEp > 1 && selectEpisode(selectedEp - 1)}
            disabled={selectedEp <= 1}
            className="flex-1 py-2.5 px-3 rounded-lg bg-primary/15 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" /> Anterior
          </button>
          <button
            onClick={() => setShowEpisodes((v) => !v)}
            className="px-3 py-2.5 rounded-lg bg-primary/25 hover:bg-primary/40 border border-primary/60 text-primary text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95"
            aria-label="Mostrar lista de episodios"
          >
            <List className="w-4 h-4" />
            EP {selectedEp}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showEpisodes ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={() => selectedEp < maxEpisodeForLang && selectEpisode(selectedEp + 1)}
            disabled={selectedEp >= maxEpisodeForLang}
            className="flex-1 py-2.5 px-3 rounded-lg bg-primary/15 hover:bg-primary/30 border border-primary/40 text-primary text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-25 disabled:cursor-not-allowed transition-all active:scale-95"
          >
            Siguiente <ChevronLeft className="w-4 h-4 rotate-180" />
          </button>
        </div>

        <AdsterraBanner
          adKey="b411f21fa26a4e8427eb13433959b4e8"
          width={300}
          height={250}
          uid="watch-ep-300x250"
        />
      </div>

      <div className="px-4 mt-6">
        <AdsterraBanner
          adKey="b411f21fa26a4e8427eb13433959b4e8"
          width={320}
          height={50}
          uid="watch-bottom-320x50"
        />
      </div>

      {/* Lista colapsable de episodios */}
      {showEpisodes && (
        <div className="px-4">
          <h2 className="text-sm font-bold text-foreground mb-3">
            Episodios <span className="text-muted-foreground font-normal">({totalEpisodes})</span>
          </h2>
          {episodeNumbers.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 max-h-[60vh] overflow-y-auto pr-1">
              {episodeNumbers.map((epNum) => {
                const isActive = epNum === selectedEp;
                const epSlug = zetSlug ? `${zetSlug}-${epNum}` : "";
                const watched = epSlug ? watchedSet.has(epSlug) : false;
                const blocked = maxEpisodeForLang > 0 && epNum > maxEpisodeForLang;
                return (
                  <div key={epNum} className={`flex rounded-lg overflow-hidden transition-all ${isActive ? "ring-2 ring-primary/50" : ""} ${blocked ? "opacity-40" : ""}`}>
                    <button onClick={() => { if (blocked) return; selectEpisode(epNum); setShowEpisodes(false); }}
                      disabled={blocked}
                      title={blocked ? "Aún no disponible" : undefined}
                      className={`flex-1 py-2 px-2 text-xs font-bold transition-all text-left ${isActive ? "bg-primary text-primary-foreground" : watched ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"} disabled:cursor-not-allowed`}>
                      EP {epNum}{blocked ? " 🔒" : ""}
                    </button>
                    <button
                      onClick={() => toggleWatched(epNum)}
                      disabled={!user || blocked}
                      title={!user ? "Inicia sesión para marcar episodios" : (watched ? "Marcado como visto" : "Marcar como visto")}
                      className={`w-7 flex items-center justify-center transition-all border-l border-background/20 ${watched ? "bg-primary text-primary-foreground" : "bg-secondary/80 text-muted-foreground hover:text-primary"} disabled:opacity-50 disabled:cursor-not-allowed`}>
                      {watched ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Cargando episodios...</p>
          )}
        </div>
      )}
    </div>
  );
}
