import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getEpisodeServers, sortServersByPriority,
  markEpisodeWatched, getWatchedEpisodes, setWatchedEpisodes, titleToSlug, getCachedSlug,
  saveCachedSlug, getLatinoEpisode,
  clearSeekeEpisodeCache,
  type ZetServer,
} from "@/lib/zetapi";
import { resolveSlugMultiAPI } from "@/lib/slug-resolver";
import { getCachedVideo, cachedVideoToSources, clearRuntimeVideoCache } from "@/lib/video-cache";
import { resolveSeekeBaseForEpisode, getLatestEpisodeByLang, listBlocks, buildEpisodeSlots, type EpisodeSlot } from "@/lib/video-blocks";
import { getAnimeById, getTitle } from "@/lib/anilist";
import {
  Eye, EyeOff, ChevronLeft, ChevronRight, AlertCircle,
  Headphones, ChevronDown, List,
} from "lucide-react";

import AdsterraBanner from "@/components/ads/AdsterraBanner";
import AdOverlayGate from "@/components/ads/AdOverlayGate";
import AdblockPlayerOverlay from "@/components/ads/AdblockPlayerOverlay";
import AnimePlayer from "@/components/video/AnimePlayer";
import StreamGuard from "@/components/video/StreamGuard";
import ReportBrokenLink from "@/components/anime/ReportBrokenLink";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { useProfiles } from "@/contexts/ProfilesContext";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { isWebView, saveVideoProgress, getVideoProgress } from "@/lib/webview";
import { resolveEpisodeCount } from "@/lib/episode-count";
import EpisodeList from "@/components/anime/EpisodeList";
import { useEpisodeThumbnails } from "@/lib/episode-thumbnails";

type Lang = "sub" | "latino";

type PlayerSourceItem = { name: string; embed: string; type?: string; episode?: number; variant?: number; lang: Lang; origin: "db" | "api" | "hls" | "seeke" };

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
  const variantParam = Math.max(1, Number(searchParams.get("v") || 1));
  const { user } = useAuth();
  const { permissions } = usePlanPermissions();
  const { activeProfile } = useProfiles();
  const profileId = activeProfile?.id ?? null;
  const watchedScope = user?.id && profileId ? `${user.id}:${profileId}` : null;
  const inWebView = isWebView();

  const [selectedEp, setSelectedEp] = useState(epParam);
  const [selectedVariant, setSelectedVariant] = useState(variantParam);
  const [lang, setLang] = useState<Lang>("sub");
  
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
  // Visibilidad del botón "Volver": sigue a los controles del player y se oculta con el panel de episodios
  const [playerControlsVisible, setPlayerControlsVisible] = useState(true);
  const [playerEpPanelOpen, setPlayerEpPanelOpen] = useState(false);
  const [playerIsFullscreen, setPlayerIsFullscreen] = useState(false);
  // Estado reactivo de episodios "vistos" para refrescar el ojito en tiempo real
  const [watchedSet, setWatchedSet] = useState<Set<string>>(() => new Set(getWatchedEpisodes(watchedScope)));

  useEffect(() => {
    if (didResetSeekeRuntimeCache) return;
    didResetSeekeRuntimeCache = true;
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

  // Latino HLS check
  const { data: latinoEp } = useQuery({
    queryKey: ["latino-ep", zetSlug, selectedEp],
    queryFn: () => getLatinoEpisode(zetSlug!, selectedEp),
    enabled: !!zetSlug,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  // 1) Catálogo oficial DB: lo guardado en admin manda, sin cache local.
  const { data: cachedVideo, isFetched: cachedVideoFetched } = useQuery({
    queryKey: ["video-cache", zetSlug, selectedEp, lang],
    queryFn: () => getCachedVideo(zetSlug || animeTitle || String(anilistId), selectedEp, lang, anilistId),
    enabled: anilistId > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  // 1b) Catálogo oficial del IDIOMA OPUESTO — para completar el toggle cuando
  // la API solo trae 1 idioma (típicamente JP). Si el admin guardó manualmente
  // el otro idioma en DB, lo combinamos para que el botón "Cambiar idioma" funcione.
  const oppositeLang: Lang = lang === "sub" ? "latino" : "sub";
  const { data: cachedVideoOpposite, isFetched: cachedVideoOppositeFetched } = useQuery({
    queryKey: ["video-cache-opposite", zetSlug, selectedEp, oppositeLang],
    queryFn: () => getCachedVideo(zetSlug || animeTitle || String(anilistId), selectedEp, oppositeLang, anilistId),
    enabled: anilistId > 0 && !!zetSlug,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });

  // Bloques: si están definidos, sobreescriben la URL madre única para el ep actual.
  const { data: currentBlock } = useQuery({
    queryKey: ["seeke-block", anilistId, lang, selectedEp, selectedVariant],
    queryFn: () => resolveSeekeBaseForEpisode(anilistId, lang, selectedEp, selectedVariant),
    enabled: anilistId > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const { data: oppositeBlock } = useQuery({
    queryKey: ["seeke-block", anilistId, oppositeLang, selectedEp, selectedVariant],
    queryFn: () => resolveSeekeBaseForEpisode(anilistId, oppositeLang, selectedEp, selectedVariant),
    enabled: anilistId > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const { data: currentBlocks = [], isFetched: currentBlocksFetched } = useQuery({
    queryKey: ["seeke-blocks", anilistId, lang],
    queryFn: () => listBlocks(anilistId, lang),
    enabled: anilistId > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const { data: oppositeBlocks = [], isFetched: oppositeBlocksFetched } = useQuery({
    queryKey: ["seeke-blocks", anilistId, oppositeLang],
    queryFn: () => listBlocks(anilistId, oppositeLang),
    enabled: anilistId > 0,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
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
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  const { data: latestOpposite, isFetched: latestOppositeFetched } = useQuery({
    queryKey: ["latest-ep", anilistId, oppositeLang, oppositeSeekeBase],
    queryFn: () => getLatestEpisodeByLang(anilistId, oppositeLang, oppositeSeekeBase),
    enabled: anilistId > 0 && hasOppositeSeekeConfig,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
  });
  // 2) Episode servers fallback. Si existe cualquier configuración Seeke para
  // este anime, NO se consulta AV1/Zilla: Seeke manda o se bloquea el episodio.
  const { data: serverData, isLoading: loadingServers, error: serverError } = useQuery({
    queryKey: ["zet-servers", zetSlug, selectedEp, lang],
    queryFn: () => getEpisodeServers(zetSlug!, selectedEp, lang),
    enabled: !!zetSlug && cachedVideoFetched && seekeConfigReady && !hasAnySeekeConfig,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
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
  const episodeThumbs = useEpisodeThumbnails(anilistData as any, totalEpisodes);
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
  // Slots: si hay bloques solapados, un mismo ep aparece varias veces (variant 1..N).
  const episodeSlots = useMemo(() => {
    if (!currentBlocks || currentBlocks.length === 0) {
      return episodeNumbers.map((ep) => ({ ep, variant: 1, blockLabel: null as string | null }));
    }
    return buildEpisodeSlots(currentBlocks as any, totalEpisodes).map((s) => ({
      ep: s.ep, variant: s.variant, blockLabel: s.blockLabel ?? null,
    }));
  }, [currentBlocks, episodeNumbers, totalEpisodes]);
  const currentSlotIndex = useMemo(
    () => episodeSlots.findIndex((s) => s.ep === selectedEp && s.variant === selectedVariant),
    [episodeSlots, selectedEp, selectedVariant]
  );

  const { data: oppositeServerData } = useQuery({
    queryKey: ["zet-servers-opposite", zetSlug, selectedEp, oppositeLang],
    queryFn: () => getEpisodeServers(zetSlug!, selectedEp, oppositeLang),
    enabled: !!zetSlug && cachedVideoOppositeFetched && seekeConfigReady && !hasOppositeSeekeConfig,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
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
        // ⚠️ El player pasa este número al edge; debe ser el ABSOLUTO del anime
        // para que resolve-stream vuelva a matchear el bloque correcto usando variant.
        episode: selectedEp,
        variant: block.variant,
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

    const addSeekeBaseOnly = (cached: typeof cachedVideo, baseUrl: string | undefined, sourceLang: Lang) => {
      if (!cached || !baseUrl) return;
      addDb({ ...cached, sources: { seeke: [baseUrl], hls: [], mp4: [], embed: [], pc: [], mobile: [] } } as any, sourceLang, false);
    };

    // Si hay Seeke/bloques, el player usa SOLO petición directa a VPS.
    // No añadimos HLS/embed resueltos guardados porque eso era el cache que podía repetir capítulos.
    if (seekeCoversCurrent) {
      addBlock(currentBlock, lang);
      if (!currentBlock) addSeekeBaseOnly(cachedVideo, currentSeekeBase, lang);
    } else if (!hasAnySeekeConfig && cachedVideo) {
      // Solo añadimos fuentes NO-seeke del DB cache (HLS/MP4/embed manuales).
      addDb({ ...cachedVideo, sources: { ...cachedVideo.sources, seeke: [] } } as any, lang, true);
    }
    // HLS Latino subido manualmente: SIEMPRE se agrega si existe, aunque haya
    // Seeke configurado en JP. Esto garantiza que el switch de idioma aparezca
    // en cualquier anime que tenga latino disponible por cualquier vía.
    if (latinoEp?.sources?.hls?.length) {
      latinoEp.sources.hls.forEach((url, i) => appendUniqueSource(sources, {
        name: `HLS Latino ${i + 1} • 🌎 LAT`, embed: url, type: "hls", lang: "latino", origin: "hls",
      }));
    }
    addApi(serverData, lang);

    // Opposite Seeke: si cubre el episodio actual, agregarlo.
    if (seekeCoversOpposite) {
      addBlock(oppositeBlock, oppositeLang);
      if (!oppositeBlock) addSeekeBaseOnly(cachedVideoOpposite, oppositeSeekeBase, oppositeLang);
    }
    // DB del idioma opuesto (HLS/MP4/embed manuales del admin): SIEMPRE se
    // agregan las fuentes NO-seeke, exista o no Seeke en el idioma actual.
    // Solo omitimos los `seeke` de la DB opuesta si el bloque ya se agregó
    // (evita duplicar) o si Seeke opuesto no cubre este episodio.
    if (cachedVideoOpposite) {
      const oppositeNoSeeke = { ...cachedVideoOpposite, sources: { ...cachedVideoOpposite.sources, seeke: [] } } as any;
      addDb(oppositeNoSeeke, oppositeLang, true);
    }
    addApi(oppositeServerData, oppositeLang);

    return sources.sort((a, b) => sourcePriority(a) - sourcePriority(b));
  }, [lang, latinoEp, serverData, cachedVideo, cachedVideoOpposite, oppositeLang, oppositeServerData, selectedEp, currentBlock, oppositeBlock, seekeCoversCurrent, seekeCoversOpposite, hasAnySeekeConfig, currentSeekeBase, oppositeSeekeBase]);

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
  // Mostrar el switch de idioma si existe configuración Seeke (URL madre o
  // bloque) en AMBOS idiomas, o si hay fuentes DB en ambos, o si hay solo un
  // idioma en DB pero la API cubre el opuesto.
  const hasSeekeConfigBothLanguages = hasCurrentSeekeConfig && hasOppositeSeekeConfig;
  const shouldShowLanguageControls = hasSeekeConfigBothLanguages || (hasDbBothLanguages && dbLikeCount > 0) || hasApiOnlyOppositeLang;
  const shouldShowServerControl = hasMultipleSources && !shouldShowLanguageControls && !hasSeekeBothLanguages;
  const sortedSources = useMemo(() => {
    // REGLA ESTRICTA: el reproductor SOLO recibe fuentes del idioma seleccionado.
    // Antes se colaban fuentes del idioma opuesto y, si la actual fallaba, el
    // fallback interno saltaba al opuesto (JP↔LAT sin acción del usuario).
    // Ahora el cambio de idioma es 100% manual vía el toggle.
    const onlyCurrentLang = rawSources.filter((s) => s.lang === lang);
    // Fallback de seguridad: si el idioma actual no tiene fuentes pero el otro
    // sí, devolvemos igual solo las del actual (vacío) — la UI mostrará el
    // mensaje de "sin servidores" y el usuario decide cambiar de idioma.
    const pool = onlyCurrentLang;
    if (shouldShowLanguageControls) {
      const hasDbLikeForLang = dbLangAvailability[lang] > 0;
      return [...pool].sort((a, b) => {
        const aMatch = hasDbLikeForLang ? (a.origin === "db" || a.origin === "hls" || a.origin === "seeke") : true;
        const bMatch = hasDbLikeForLang ? (b.origin === "db" || b.origin === "hls" || b.origin === "seeke") : true;
        const aRank = aMatch ? 0 : 1;
        const bRank = bMatch ? 0 : 1;
        return aRank - bRank || sourcePriority(a) - sourcePriority(b);
      });
    }
    return activeSourceIdx > 0 && activeSourceIdx < pool.length
      ? [pool[activeSourceIdx], ...pool.filter((_, i) => i !== activeSourceIdx)]
      : pool;
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
  const selectEpisode = (epNumber: number, variant: number = 1) => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const hasFullscreen = Boolean(document.fullscreenElement || doc.webkitFullscreenElement);

    if (hasFullscreen && playerWrapperRef.current && document.fullscreenElement !== playerWrapperRef.current) {
      try { playerWrapperRef.current.requestFullscreen?.().catch(() => undefined); } catch { void 0; }
    }
    if (hasFullscreen) {
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (o: OrientationLockType) => Promise<void>;
      };
      try { orientation.lock?.("landscape").catch(() => undefined); } catch { void 0; }
    }
    const v = Math.max(1, variant);
    setSelectedEp(epNumber);
    setSelectedVariant(v);
    setActiveSourceIdx(0);
    const q = v > 1 ? `?ep=${epNumber}&v=${v}` : `?ep=${epNumber}`;
    navigate(`/watch/${id}${q}`, { replace: true });
    watchTimeRef.current = 0;
    if (!inWebView) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const goToSlotOffset = (delta: number) => {
    if (currentSlotIndex < 0) {
      selectEpisode(selectedEp + delta, 1);
      return;
    }
    const next = episodeSlots[currentSlotIndex + delta];
    if (!next) return;
    selectEpisode(next.ep, next.variant);
  };
  const prevSlot = episodeSlots[currentSlotIndex - 1];
  const nextSlot = episodeSlots[currentSlotIndex + 1];

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
  const streamingEp = (anilistData as any)?.streamingEpisodes?.[selectedEp - 1];
  const currentEpisodeTitle = streamingEp?.title?.replace(/^Episode\s*\d+\s*[-–]?\s*/i, "") || "";
  const rawSynopsis = (anilistData as any)?.description || "";
  const synopsis = rawSynopsis ? rawSynopsis.replace(/<[^>]+>/g, "").trim() : "";
  const isSeekeLatestLoading = hasAnySeekeConfig && !latestReady;
  const isLoading = loadingSlug || !cachedVideoFetched || !cachedVideoOppositeFetched || !seekeConfigReady || loadingServers || isSeekeLatestLoading;
  // IMPORTANT: keep previous playerSources mounted while loading the next episode
  // so the iframe DOM node (and thus fullscreen state) is preserved.
  const displayedSources = !isLoading && sortedSources.length > 0 ? sortedSources : playerSources;
  const displayedEpisode = !isLoading && sortedSources.length > 0 ? selectedEp : playerEpisode;
  const displayedAutoNextKey = `${anilistId}-${displayedEpisode}`;
  const isEpisodeSwitching = isLoading && playerSources.length > 0;
  const sortedSourcesKey = sortedSources.map((source) => `${source.type || ""}|${source.embed}|${source.episode ?? ""}|${source.lang}`).join("¶");
  const sortedSourcesRef = useRef(sortedSources);
  sortedSourcesRef.current = sortedSources;

  useEffect(() => {
    if (sortedSourcesRef.current.length === 0 || isLoading) return;
    setPlayerSources(sortedSourcesRef.current);
    setPlayerEpisode(selectedEp);
  }, [sortedSourcesKey, isLoading, selectedEp]);

  return (
    <div className="min-h-screen pb-24">
      {/* Player edge-to-edge en móvil, con línea de acento sutil */}
      <div className="sm:px-4 sm:pt-4 mb-3">
        <div className="relative">
          <div
            ref={playerWrapperRef}
            id="zet-player-container"
            className="zet-player-container relative z-10 aspect-video bg-black sm:rounded-xl overflow-hidden border-y sm:border-2 border-primary/50 select-none"
            style={{
              boxShadow: "0 0 0 1px hsl(var(--primary) / 0.2), 0 0 12px hsl(var(--primary) / 0.25)",
            }}
          >
            {/* Botón Volver — se oculta con los controles del player y cuando el panel de episodios está abierto */}
            {(() => {
              const hideForPanel = playerEpPanelOpen;
              const hideForControls = playerIsFullscreen && !playerControlsVisible;
              const visible = !hideForPanel && !hideForControls;
              return (
                <Link
                  to={`/anime/${id}`}
                  aria-label="Volver al anime"
                  tabIndex={visible ? 0 : -1}
                  aria-hidden={!visible}
                  className={`absolute top-4 right-3 z-40 w-9 h-9 rounded-full bg-black/55 backdrop-blur-sm border border-primary/50 text-primary flex items-center justify-center hover:bg-primary/25 hover:text-white shadow-[0_0_10px_hsl(var(--primary)/0.4)] transition-all duration-500 ${
                    visible
                      ? "opacity-100 translate-x-0 pointer-events-auto active:scale-95"
                      : "opacity-0 translate-x-4 pointer-events-none"
                  }`}
                >
                  <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
                </Link>
              );
            })()}


          {isEpisodeBlocked ? (
            <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3 px-4 text-center">
              <AlertCircle className="w-10 h-10 text-primary" />
              <p className="text-sm font-bold text-foreground">Episodio aún no disponible</p>
              <p className="text-[11px] text-muted-foreground max-w-sm">
                El episodio {selectedEp} todavía no se ha emitido o cargado para este idioma. Último disponible: <span className="text-primary font-bold">EP {maxEpisodeForLang}</span>.
              </p>
            </div>
          ) : isLoading && playerSources.length === 0 ? (
            <Skeleton bolt className="aspect-video bg-secondary rounded-xl" />
          ) : displayedSources.length > 0 ? (
            <StreamGuard animeId={anilistId} episode={selectedEp}>
              <AnimePlayer
                sources={displayedSources}
                anilistId={anilistId}
                lang={lang}
                title={`${displayTitle} - EP ${displayedEpisode}${selectedVariant > 1 ? ` · Parte ${selectedVariant}` : ""}`}
                onProgress={isEpisodeSwitching ? undefined : handleProgress}
                onSeeked={isEpisodeSwitching ? undefined : handleSeeked}
                initialTime={initialTime}
                showServerPicker={shouldShowServerControl}
                episodeKey={displayedAutoNextKey}
                canPrev={!!prevSlot}
                canNext={!!nextSlot && (nextSlot.ep <= maxEpisodeForLang)}
                onPrev={() => goToSlotOffset(-1)}
                onNext={() => nextSlot && nextSlot.ep <= maxEpisodeForLang && goToSlotOffset(1)}
                onAutoNext={isEpisodeSwitching ? undefined : handleAutoNext}
                autoNextAlreadyTriggered={autoNextDone.has(displayedAutoNextKey)}
                currentEpisode={displayedEpisode}
                totalEpisodes={totalEpisodes}
                episodeSlots={episodeSlots}
                currentVariant={selectedVariant}
                onSelectEpisode={(n, v) => selectEpisode(n, v || 1)}
                episodeThumbnails={episodeThumbs}
                subtitles={activeSubtitles}
                fullscreenContainerRef={playerWrapperRef}
                onControlsVisibilityChange={setPlayerControlsVisible}
                onEpisodeListToggle={setPlayerEpPanelOpen}
                onFullscreenChange={setPlayerIsFullscreen}
              />
              {isEpisodeSwitching && (
                <div className="pointer-events-none absolute right-3 top-3 z-40 rounded-md border border-primary/35 bg-background/80 px-2.5 py-1.5 text-[10px] font-bold text-foreground shadow-[0_0_18px_hsl(var(--primary)/0.25)]">
                  EP {selectedEp}
                </div>
              )}
              <AdOverlayGate
                episodeKey={`${anilistId}-${selectedEp}`}
                everyN={1}
                countdownSecs={5}
              />
              <AdblockPlayerOverlay />

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





      {/* Title + details */}
      <div className="px-4 sm:px-6 mt-4 sm:mt-6 mb-5">
        <h1 className="font-steam text-2xl sm:text-4xl font-black uppercase tracking-wider text-foreground leading-none mb-2 line-clamp-2">
          {displayTitle}
        </h1>
        <p className="text-sm sm:text-base font-medium text-foreground/85 mb-2">
          Episodio {selectedEp}
          {currentEpisodeTitle && (
            <span className="text-muted-foreground"> • “{currentEpisodeTitle}”</span>
          )}
        </p>
        {inWebView && (
          <p className="text-[10px] text-muted-foreground/70 mb-3">📱 APK{zetSlug && ` • ${zetSlug}`}</p>
        )}

        {/* Idioma + Reporte — fila unificada */}
        {(shouldShowLanguageControls || (zetSlug && anilistData)) && (
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {shouldShowLanguageControls && (
              <div className="inline-flex rounded-xl bg-secondary/60 border border-border/60 p-1 gap-1">
                {(["sub", "latino"] as const).map((targetLang) => {
                  const enabled = hasSeekeConfigBothLanguages
                    ? (targetLang === "sub" ? hasCurrentSeekeConfig || hasOppositeSeekeConfig : hasCurrentSeekeConfig || hasOppositeSeekeConfig)
                    : langAvailability[targetLang] > 0;
                  const selected = activeLang === targetLang;
                  const meta = targetLang === "sub"
                    ? { label: "JAPONÉS", sub: "AUDIO: JPN · SUB: ESP" }
                    : { label: "LATINO", sub: "AUDIO: LAT" };
                  return (
                    <button
                      key={targetLang}
                      disabled={!enabled}
                      onClick={() => { if (!enabled) return; setLang(targetLang); setActiveSourceIdx(0); }}
                      className={`flex items-center gap-2.5 px-3 sm:px-4 py-2 rounded-lg text-left transition-all disabled:opacity-35 disabled:cursor-not-allowed ${
                        selected
                          ? "bg-background border border-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                          : "border border-transparent hover:bg-background/40"
                      }`}
                    >
                      <Headphones className={`w-4 h-4 flex-shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      <span className="flex flex-col leading-tight">
                        <span className={`text-[11px] sm:text-xs font-black tracking-wide ${selected ? "text-foreground" : "text-muted-foreground"}`}>
                          {meta.label}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-muted-foreground/80 uppercase tracking-wider">
                          {meta.sub}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {zetSlug && anilistData && (
              <ReportBrokenLink
                slug={zetSlug}
                episodeNumber={selectedEp}
                animeTitle={displayTitle}
                animeCover={anilistData.coverImage?.large || anilistData.coverImage?.extraLarge || ""}
                anilistId={anilistId}
                iconOnly
                className="w-11 h-11"
              />
            )}
          </div>
        )}

        {shouldShowServerControl && (
          <div className="mb-3">
            <button
              onClick={() => setActiveSourceIdx((i) => (i + 1) % Math.max(1, rawSources.length))}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary border border-border text-foreground hover:border-primary hover:text-primary transition-all"
            >
              Servidor: {Math.min(activeSourceIdx + 1, rawSources.length)}/{rawSources.length}
            </button>
          </div>
        )}

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
      </div>

      {/* Navegación de episodios — fila móvil estricta sin salto de línea */}
      <div className="px-4 mb-4">
        <div className="flex min-w-0 w-full flex-row flex-nowrap items-center gap-1.5 sm:gap-2 overflow-hidden">
          <button
            onClick={() => prevSlot && goToSlotOffset(-1)}
            disabled={!prevSlot}
            className="h-10 min-w-0 flex-[1_1_0%] rounded-lg bg-secondary/70 hover:bg-secondary border border-border/60 text-foreground text-[10px] min-[380px]:text-[11px] sm:text-xs font-bold flex items-center justify-center gap-0.5 sm:gap-1 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 whitespace-nowrap overflow-hidden px-1.5 sm:px-3"
          >
            <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
            <span className="min-w-0 truncate">Anterior</span>
          </button>
          <button
            onClick={() => setShowEpisodes((v) => !v)}
            className="h-10 min-w-0 flex-[1.25_1_0%] rounded-lg bg-secondary/70 hover:bg-secondary border border-border/60 text-foreground text-[10px] min-[380px]:text-[11px] sm:text-xs font-bold flex items-center justify-center gap-0.5 sm:gap-1.5 transition-all active:scale-95 whitespace-nowrap overflow-hidden px-1 sm:px-3"
            aria-label="Mostrar lista de episodios"
          >
            <List className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
            <span className="min-w-0 truncate tabular-nums">
              <span className="sm:hidden">EP {selectedEp}{selectedVariant > 1 ? `·P${selectedVariant}` : ""}/{totalEpisodes}</span>
              <span className="hidden sm:inline">EPISODIOS ({selectedEp}{selectedVariant > 1 ? ` · Parte ${selectedVariant}` : ""}/{totalEpisodes})</span>
            </span>
            <ChevronDown className={`w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0 transition-transform ${showEpisodes ? "rotate-180" : ""}`} />
          </button>
          <button
            onClick={() => nextSlot && nextSlot.ep <= maxEpisodeForLang && goToSlotOffset(1)}
            disabled={!nextSlot || nextSlot.ep > maxEpisodeForLang}
            className="h-10 min-w-0 flex-[1_1_0%] rounded-lg bg-primary text-primary-foreground border border-primary hover:bg-primary/90 text-[10px] min-[380px]:text-[11px] sm:text-xs font-bold flex items-center justify-center gap-0.5 sm:gap-1 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-[0_0_12px_hsl(var(--primary)/0.35)] whitespace-nowrap overflow-hidden px-1.5 sm:px-3"
          >
            <span className="min-w-0 truncate">Siguiente</span>
            <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
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
            <EpisodeList
              total={totalEpisodes}
              cover={anilistData?.coverImage?.extraLarge || anilistData?.coverImage?.large || ""}
              animeTitle={anilistData ? getTitle(anilistData) : ""}
              streamingEpisodes={(anilistData as any)?.streamingEpisodes}
              thumbnails={episodeThumbs}
              selected={selectedEp}
              selectedVariant={selectedVariant}
              slots={episodeSlots}
              watched={watchedSet}
              slug={zetSlug}
              maxAvailable={maxEpisodeForLang}
              onSelect={(ep, v) => { selectEpisode(ep, v || 1); setShowEpisodes(false); }}
              onToggleWatched={(ep) => toggleWatched(ep)}
            />
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Cargando episodios...</p>
          )}
        </div>
      )}
    </div>
  );
}
