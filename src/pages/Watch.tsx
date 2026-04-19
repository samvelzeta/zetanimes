import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getEpisodeServers, sortServersByPriority,
  isEpisodeWatched, markEpisodeWatched, getWatchedEpisodes, titleToSlug, getCachedSlug,
  saveCachedSlug, getLatinoEpisode,
  type ZetServer,
} from "@/lib/zetapi";
import { resolveSlugMultiAPI } from "@/lib/slug-resolver";
import { getCachedVideo, cachedVideoToSources } from "@/lib/video-cache";
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
import { supabase } from "@/integrations/supabase/client";
import { isWebView, saveVideoProgress, getVideoProgress } from "@/lib/webview";
import { resolveEpisodeCount } from "@/lib/episode-count";

type Lang = "sub" | "latino";

const episodeCache = new Map<string, any>();

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const anilistId = Number(id);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const epParam = Number(searchParams.get("ep") || 1);
  const { user } = useAuth();
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
  const lastSavedProgressRef = useRef(0);
  // Estado reactivo de episodios "vistos" para refrescar el ojito en tiempo real
  const [watchedSet, setWatchedSet] = useState<Set<string>>(() => new Set(getWatchedEpisodes()));

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

  // Latino HLS check
  const { data: latinoEp } = useQuery({
    queryKey: ["latino-ep", zetSlug, selectedEp],
    queryFn: () => getLatinoEpisode(zetSlug!, selectedEp),
    enabled: !!zetSlug && lang === "latino",
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
    enabled: !!zetSlug && !cachedVideo && !(lang === "latino" && latinoEp),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  // Build sources: cache DB > latino HLS > scraper, completando con DB del idioma opuesto
  const buildSources = useCallback(() => {
    const sources: { name: string; embed: string; type?: string }[] = [];

    // 1. Cache global de DB (admin uploads) del idioma actual
    if (cachedVideo) {
      sources.push(...cachedVideoToSources(cachedVideo));
    }

    // 2. Latino HLS sources
    if (lang === "latino" && latinoEp?.sources?.hls) {
      latinoEp.sources.hls.forEach((url: string, i: number) => {
        sources.push({ name: `HLS Latino ${i + 1}`, embed: url, type: "hls" });
      });
    }

    // 3. Scraper servers (fallback)
    const scraperServers = serverData?.servers || [];
    scraperServers.forEach((s: ZetServer) => {
      if (s.embed) sources.push({ name: s.name, embed: s.embed });
    });

    // 4. Si solo tenemos 1 fuente, intentamos completar con la del IDIOMA OPUESTO
    //    guardada manualmente en DB (admin). Así el botón "Cambiar idioma" funciona
    //    incluso cuando la API solo devuelve 1 server (caso típico: Black Clover sólo JP).
    if (sources.length < 2 && cachedVideoOpposite) {
      const opp = cachedVideoToSources(cachedVideoOpposite).map((s) => ({
        ...s,
        name: `${s.name} • ${oppositeLang === "latino" ? "🌎 LAT" : "🇯🇵 JP"}`,
      }));
      sources.push(...opp);
    }

    return sources;
  }, [lang, latinoEp, serverData, cachedVideo, cachedVideoOpposite, oppositeLang]);

  const rawSources = buildSources();
  // Si el usuario rotó manualmente, mover esa fuente al inicio para que el player la cargue
  const sortedSources = activeSourceIdx > 0 && activeSourceIdx < rawSources.length
    ? [rawSources[activeSourceIdx], ...rawSources.filter((_, i) => i !== activeSourceIdx)]
    : rawSources;

  // Total de fuentes disponibles (cache + scraper + latino HLS)
  // Si hay 2+ sources → permite cambiar entre ellos (típicamente JP/LATINO o servidores diferentes)
  // Si hay HLS latino dedicado → toggle real entre sub/latino
  const hasLatinoHLS = !!latinoEp;
  const hasMultipleSources = sortedSources.length >= 2;
  const hasMultipleLangs = hasLatinoHLS || hasMultipleSources;
  const langButtonLabel = hasMultipleLangs ? "Cambiar idioma" : "Idioma predeterminado";

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

  // Helper: marca el episodio como visto en estado + localStorage (sólo logueado)
  const markWatchedReactive = useCallback((epSlug: string) => {
    if (!user) return; // sólo registrados
    if (watchedSet.has(epSlug)) return;
    markEpisodeWatched(epSlug);
    setWatchedSet((prev) => {
      const next = new Set(prev);
      next.add(epSlug);
      return next;
    });
  }, [user, watchedSet]);

  const getHistoryBase = useCallback(() => {
    if (!user || !anilistData) return null;
    const cover = anilistData?.coverImage?.extraLarge || anilistData?.coverImage?.large || "";
    const title = getTitle(anilistData);

    return {
      user_id: user.id,
      anime_id: anilistId,
      episode_number: selectedEp,
      anime_title: title,
      anime_cover: cover,
    };
  }, [user, anilistData, anilistId, selectedEp]);

  const ensureHistoryEntry = useCallback(async () => {
    const base = getHistoryBase();
    if (!base) return null;

    if (historyEntryIdRef.current) return historyEntryIdRef.current;

    const { data: existing, error: readError } = await supabase
      .from("watch_history")
      .select("id")
      .eq("user_id", base.user_id)
      .eq("anime_id", base.anime_id)
      .eq("episode_number", base.episode_number)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

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
    const shouldPersistJump = Math.abs(pct - lastSavedProgressRef.current) >= 0.15;

    // Save progress every ~5 ticks or immediately after large manual seeks
    if (zetSlug && (watchTimeRef.current % 5 === 0 || shouldPersistJump)) {
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
      const all = getWatchedEpisodes().filter((s) => s !== epSlug);
      localStorage.setItem("zet_watched_episodes", JSON.stringify(all));
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
                initialTime={initialTime}
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
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          {hasMultipleLangs ? (
            <button
              onClick={() => {
                if (hasLatinoHLS) {
                  setLang(lang === "sub" ? "latino" : "sub");
                } else {
                  setActiveSourceIdx((i) => (i + 1) % Math.max(1, sortedSources.length));
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/15 border border-primary/40 text-primary hover:bg-primary/25 transition-all flex items-center gap-1.5"
            >
              {langButtonLabel}
              <span className="text-[10px] opacity-80">
                {hasLatinoHLS
                  ? `(${lang === "sub" ? "🇯🇵 JP → 🌎 LAT" : "🌎 LAT → 🇯🇵 JP"})`
                  : `(${sortedSources[activeSourceIdx]?.name || "—"})`}
              </span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground">
              {langButtonLabel}
            </span>
          )}
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
