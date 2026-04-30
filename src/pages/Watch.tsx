import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getEpisodeServers, sortServersByPriority,
  markEpisodeWatched, getWatchedEpisodes, setWatchedEpisodes, titleToSlug, getCachedSlug,
  saveCachedSlug, getLatinoEpisode, getSeekeEpisode,
  clearSeekeEpisodeCache,
  type ZetServer,
} from "@/lib/zetapi";
import { resolveSlugMultiAPI } from "@/lib/slug-resolver";
import { getCachedVideo, cachedVideoToSources, getPlaybackPlatform } from "@/lib/video-cache";
import { getAnimeById, getTitle } from "@/lib/anilist";
import {
  Eye, EyeOff, ChevronLeft, Loader2, AlertCircle,
  Globe, Bug, ChevronDown, List,
} from "lucide-react";
import AdsterraBanner from "@/components/ads/AdsterraBanner";
import AdOverlayGate from "@/components/ads/AdOverlayGate";
import AnimePlayer from "@/components/video/AnimePlayer";
import PlayerOverlay from "@/components/video/PlayerOverlay";
import ReportBrokenLink from "@/components/anime/ReportBrokenLink";
import { useAuth } from "@/contexts/AuthContext";
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
  const { activeProfile } = useProfiles();
  const profileId = activeProfile?.id ?? null;
  const watchedScope = user?.id && profileId ? `${user.id}:${profileId}` : null;
  const inWebView = isWebView();

  const [selectedEp, setSelectedEp] = useState(epParam);
  const [lang, setLang] = useState<Lang>("sub");
  const [showDebug, setShowDebug] = useState(false);
  const watchTimeRef = useRef(0);
  const historyEntryIdRef = useRef<string | null>(null);
  const [initialTime, setInitialTime] = useState<number | undefined>(undefined);
  const playerWrapperRef = useRef<HTMLDivElement>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [activeSourceIdx, setActiveSourceIdx] = useState(0);
  const [autoNextDone, setAutoNextDone] = useState<Set<string>>(() => new Set());
  const lastSavedProgressRef = useRef(0);
  // Estado reactivo de episodios "vistos" para refrescar el ojito en tiempo real
  const [watchedSet, setWatchedSet] = useState<Set<string>>(() => new Set(getWatchedEpisodes(watchedScope)));

  useEffect(() => {
    if (didResetSeekeRuntimeCache) return;
    didResetSeekeRuntimeCache = true;
    episodeCache.clear();
    clearSeekeEpisodeCache();
  }, []);

  useEffect(() => {
    setWatchedSet(new Set(getWatchedEpisodes(watchedScope)));
  }, [watchedScope]);

  useEffect(() => {
    historyEntryIdRef.current = null;
    watchTimeRef.current = 0;
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
  const totalEpisodes = resolvedTotal || anilistData?.episodes || 0;
  const episodeNumbers = Array.from({ length: Math.max(totalEpisodes, selectedEp) }, (_, i) => i + 1);

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
  const { data: cachedVideo } = useQuery({
    queryKey: ["video-cache", zetSlug, selectedEp, lang],
    queryFn: () => getCachedVideo(zetSlug || animeTitle || String(anilistId), selectedEp, lang, anilistId),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 5,
  });

  // 1b) Cache global del IDIOMA OPUESTO — para completar el toggle cuando
  // la API solo trae 1 idioma (típicamente JP). Si el admin guardó manualmente
  // el otro idioma en DB, lo combinamos para que el botón "Cambiar idioma" funcione.
  const oppositeLang: Lang = lang === "sub" ? "latino" : "sub";
  const { data: cachedVideoOpposite } = useQuery({
    queryKey: ["video-cache-opposite", zetSlug, selectedEp, oppositeLang],
    queryFn: () => getCachedVideo(zetSlug || animeTitle || String(anilistId), selectedEp, oppositeLang, anilistId),
    enabled: anilistId > 0 && !!zetSlug,
    staleTime: 1000 * 60 * 5,
  });

  // 2) Episode servers from scraper API (solo si NO hay cache de DB ni HLS latino)
  const { data: serverData, isLoading: loadingServers, error: serverError } = useQuery({
    queryKey: ["zet-servers", zetSlug, selectedEp, lang],
    queryFn: async () => {
      if (episodeCache.has(cacheKey)) return episodeCache.get(cacheKey);
      const res = await getEpisodeServers(zetSlug!, selectedEp, lang);
      episodeCache.set(cacheKey, res);
      return res;
    },
    enabled: !!zetSlug,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  const { data: oppositeServerData } = useQuery({
    queryKey: ["zet-servers-opposite", zetSlug, selectedEp, oppositeLang],
    queryFn: async () => {
      const oppositeKey = `${zetSlug}-${selectedEp}-${oppositeLang}`;
      if (episodeCache.has(oppositeKey)) return episodeCache.get(oppositeKey);
      const res = await getEpisodeServers(zetSlug!, selectedEp, oppositeLang);
      episodeCache.set(oppositeKey, res);
      return res;
    },
    enabled: !!zetSlug,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Construye fuentes híbridas por idioma: primero DB/manual, luego HLS Latino,
  // luego API. Dentro de cada fuente manual se respeta universal → PC/APK.
  const buildSources = useCallback((): PlayerSourceItem[] => {
    const sources: PlayerSourceItem[] = [];

    const addDb = (cached: typeof cachedVideo, sourceLang: Lang) => {
      if (!cached) return;
      const tag = sourceLang === "latino" ? "🌎 LAT" : "🇯🇵 JP";
      cachedVideoToSources(cached).forEach((item) => {
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

    addDb(cachedVideo, lang);
    if (lang === "latino") {
      (latinoEp?.sources?.hls || []).forEach((url, i) => appendUniqueSource(sources, {
        name: `HLS Latino ${i + 1} • 🌎 LAT`, embed: url, type: "hls", lang: "latino", origin: "hls",
      }));
    }
    addApi(serverData, lang);

    addDb(cachedVideoOpposite, oppositeLang);
    if (oppositeLang === "latino") {
      (latinoEp?.sources?.hls || []).forEach((url, i) => appendUniqueSource(sources, {
        name: `HLS Latino ${i + 1} • 🌎 LAT`, embed: url, type: "hls", lang: "latino", origin: "hls",
      }));
    }
    addApi(oppositeServerData, oppositeLang);

    return sources.sort((a, b) => sourcePriority(a) - sourcePriority(b));
  }, [lang, latinoEp, serverData, cachedVideo, cachedVideoOpposite, oppositeLang, oppositeServerData, selectedEp]);

  const rawSources = useMemo(() => buildSources(), [buildSources]);
  const langAvailability = rawSources.reduce<Record<Lang, number>>((acc, source) => {
    acc[source.lang] += 1;
    return acc;
  }, { sub: 0, latino: 0 });
  const dbLangAvailability = rawSources.reduce<Record<Lang, number>>((acc, source) => {
    if (source.origin === "db" || source.origin === "hls" || source.origin === "seeke") acc[source.lang] += 1;
    return acc;
  }, { sub: 0, latino: 0 });
  const hasMultipleSources = rawSources.length >= 2;
  const dbLikeCount = rawSources.filter((source) => source.origin === "db" || source.origin === "hls" || source.origin === "seeke").length;
  const apiCount = rawSources.filter((source) => source.origin === "api").length;
  const hasDbBothLanguages = dbLangAvailability.sub > 0 && dbLangAvailability.latino > 0;
  const shouldShowLanguageControls = hasDbBothLanguages && dbLikeCount > 0 && apiCount === 0;
  const shouldShowServerControl = hasMultipleSources && !shouldShowLanguageControls;
  const sortedSources = useMemo(() => {
    if (shouldShowLanguageControls) {
      const isDbLike = (source: PlayerSourceItem) => source.origin === "db" || source.origin === "hls" || source.origin === "seeke";
      return [...rawSources].sort((a, b) => {
        const aRank = a.lang === lang && isDbLike(a) ? 0 : 1;
        const bRank = b.lang === lang && isDbLike(b) ? 0 : 1;
        return aRank - bRank || sourcePriority(a) - sourcePriority(b);
      });
    }
    return activeSourceIdx > 0 && activeSourceIdx < rawSources.length
      ? [rawSources[activeSourceIdx], ...rawSources.filter((_, i) => i !== activeSourceIdx)]
      : rawSources;
  }, [activeSourceIdx, rawSources, shouldShowLanguageControls, lang]);
  const activeLang = sortedSources[0]?.lang || lang;
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
    if (!autoPlayEnabled || selectedEp >= (totalEpisodes || 0) || autoNextDone.has(autoNextKey)) return;
    setAutoNextDone((prev) => {
      const next = new Set(prev);
      next.add(autoNextKey);
      return next;
    });
    selectEpisode(selectedEp + 1);
  }, [autoNextDone, autoNextKey, selectedEp, totalEpisodes]);

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
    watchTimeRef.current += 1;

    // Save progress every ~5 ticks
    if (zetSlug && watchTimeRef.current % 5 === 0) {
      const video = document.querySelector("video");
      if (video && video.duration > 0) {
        saveVideoProgress(zetSlug, selectedEp, video.currentTime, video.duration);
        persistProgress(video.currentTime, video.duration, pct >= 0.7);
        lastSavedProgressRef.current = pct;
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
  const isLoading = loadingServers || loadingSlug;

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
          {isLoading ? (
            <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : sortedSources.length > 0 ? (
            <>
              <AnimePlayer
                sources={sortedSources}
                title={`${displayTitle} - EP ${selectedEp}`}
                onProgress={handleProgress}
                onSeeked={handleSeeked}
                initialTime={initialTime}
                showServerPicker={shouldShowServerControl}
                episodeKey={autoNextKey}
                canPrev={selectedEp > 1}
                canNext={selectedEp < totalEpisodes}
                onPrev={() => selectedEp > 1 && selectEpisode(selectedEp - 1)}
                onNext={() => selectedEp < totalEpisodes && selectEpisode(selectedEp + 1)}
                onAutoNext={handleAutoNext}
                autoNextAlreadyTriggered={autoNextDone.has(autoNextKey)}
              />
              {/* Overlay only visible in fullscreen — does NOT affect playback */}
              <PlayerOverlay
                episode={selectedEp}
                totalEpisodes={totalEpisodes}
                onPrev={() => selectedEp > 1 && selectEpisode(selectedEp - 1)}
                onNext={() => selectedEp < totalEpisodes && selectEpisode(selectedEp + 1)}
                containerRef={playerWrapperRef}
              />
              {/* Ad gate cada 3 episodios — bloquea video hasta cerrar */}
              <AdOverlayGate
                episodeKey={`${anilistId}-${selectedEp}`}
                everyN={3}
                countdownSecs={5}
              />
            </>
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
            const firstIdx = rawSources.findIndex((source) => source.lang === targetLang && (source.origin === "db" || source.origin === "hls" || source.origin === "seeke"));
            const enabled = firstIdx >= 0;
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
                <span className="text-[10px] opacity-80">{dbLangAvailability[targetLang]}</span>
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
            onClick={() => selectedEp < totalEpisodes && selectEpisode(selectedEp + 1)}
            disabled={selectedEp >= totalEpisodes}
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
                return (
                  <div key={epNum} className={`flex rounded-lg overflow-hidden transition-all ${isActive ? "ring-2 ring-primary/50" : ""}`}>
                    <button onClick={() => { selectEpisode(epNum); setShowEpisodes(false); }}
                      className={`flex-1 py-2 px-2 text-xs font-bold transition-all text-left ${isActive ? "bg-primary text-primary-foreground" : watched ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                      EP {epNum}
                    </button>
                    <button
                      onClick={() => toggleWatched(epNum)}
                      disabled={!user}
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
