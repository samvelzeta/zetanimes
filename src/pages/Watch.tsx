import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  getEpisodeServers, sortServersByPriority,
  isEpisodeWatched, markEpisodeWatched, titleToSlug, getCachedSlug,
  saveCachedSlug, getLatinoEpisode,
  type ZetServer,
} from "@/lib/zetapi";
import { resolveSlugMultiAPI } from "@/lib/slug-resolver";
import { getCachedVideo, cachedVideoToSources } from "@/lib/video-cache";
import { getAnimeById, getTitle } from "@/lib/anilist";
import {
  Eye, EyeOff, ChevronLeft, Loader2, AlertCircle,
  Globe, Bug, ChevronDown,
} from "lucide-react";
import AnimePlayer from "@/components/video/AnimePlayer";
import ReportBrokenLink from "@/components/anime/ReportBrokenLink";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { isWebView, saveVideoProgress, getVideoProgress } from "@/lib/webview";

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
  const [initialTime, setInitialTime] = useState<number | undefined>(undefined);

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
      const cached = await getCachedSlug(anilistId);
      if (cached) return cached;

      // Use multi-API resolver
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
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const totalEpisodes = anilistData?.episodes || 0;
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
    queryFn: () => getCachedVideo(zetSlug!, selectedEp, lang),
    enabled: !!zetSlug,
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

  // Build sources: cache DB > latino HLS > scraper
  const buildSources = useCallback(() => {
    const sources: { name: string; embed: string; type?: string }[] = [];

    // 1. Cache global de DB (admin uploads)
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

    return sources;
  }, [lang, latinoEp, serverData, cachedVideo]);

  const sortedSources = buildSources();

  // Detectar si hay 2 servers Z (HLS) en el cache DB → permite cambiar idioma
  // Sin importar si es API scrape o admin upload
  const zServersInCache = (cachedVideo?.sources?.hls?.length || 0);
  const hasMultipleLangs = zServersInCache >= 2 || !!latinoEp;
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
    navigate(`/watch/${id}?ep=${epNumber}`, { replace: true });
    watchTimeRef.current = 0;
    if (!inWebView) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleProgress = useCallback((pct: number) => {
    watchTimeRef.current += 1;

    // Save progress every ~5 ticks
    if (zetSlug && watchTimeRef.current % 5 === 0) {
      const video = document.querySelector("video");
      if (video && video.duration > 0) {
        saveVideoProgress(zetSlug, selectedEp, video.currentTime, video.duration);

        // Save to Supabase watch history with progress
        if (user) {
          const cover = anilistData?.coverImage?.extraLarge || anilistData?.coverImage?.large || "";
          const title = anilistData ? getTitle(anilistData) : "";
          const progressPct = Math.round((video.currentTime / video.duration) * 100);
          supabase.from("watch_history").upsert({
            user_id: user.id,
            anime_id: anilistId,
            episode_number: selectedEp,
            anime_title: title,
            anime_cover: cover,
            completed: pct >= 0.7,
            watch_duration_seconds: Math.round(watchTimeRef.current),
            current_time_seconds: video.currentTime,
            total_duration_seconds: video.duration,
            progress_percent: progressPct,
          } as any, { onConflict: "user_id,anime_id,episode_number" }).then(() => {});
        }
      }
    }

    if (pct >= 0.7 && zetSlug) {
      const epSlug = `${zetSlug}-${selectedEp}`;
      if (!isEpisodeWatched(epSlug)) {
        markEpisodeWatched(epSlug);
      }
    }
  }, [zetSlug, selectedEp, user, anilistId, anilistData]);

  // Save to Supabase immediately on mount/episode change
  useEffect(() => {
    if (!zetSlug || !anilistData || !user) return;
    const cover = anilistData?.coverImage?.extraLarge || anilistData?.coverImage?.large || "";
    const title = getTitle(anilistData);
    supabase.from("watch_history").upsert({
      user_id: user.id,
      anime_id: anilistId,
      episode_number: selectedEp,
      anime_title: title,
      anime_cover: cover,
      completed: false,
      current_time_seconds: 0,
      total_duration_seconds: 0,
      progress_percent: 0,
    } as any, { onConflict: "user_id,anime_id,episode_number" }).then(() => {});
  }, [zetSlug, selectedEp, anilistData, anilistId, user]);

  const toggleWatched = (epNum: number) => {
    if (!zetSlug) return;
    const epSlug = `${zetSlug}-${epNum}`;
    if (!isEpisodeWatched(epSlug)) markEpisodeWatched(epSlug);
    setSelectedEp((p) => p); // force re-render
  };

  const displayTitle = anilistData ? getTitle(anilistData) : "Cargando...";
  const isLoading = loadingServers || loadingSlug;

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-4 pb-2">
        <Link to={`/anime/${id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver al anime
        </Link>
      </div>

      {/* Player */}
      <div className="px-4 mb-4">
        {isLoading ? (
          <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : sortedSources.length > 0 ? (
          <AnimePlayer
            sources={sortedSources}
            title={`${displayTitle} - EP ${selectedEp}`}
            onProgress={handleProgress}
            initialTime={initialTime}
          />
        ) : (
          <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-10 h-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center px-4">
              {serverError ? "Error al cargar servidores." : !zetSlug ? "Buscando anime..." : "No hay servidores disponibles"}
            </p>
          </div>
        )}
      </div>

      {/* Title + controls */}
      <div className="px-4 mb-4">
        <h1 className="text-base font-bold text-foreground mb-1">{displayTitle}</h1>
        <p className="text-xs text-muted-foreground mb-3">
          Episodio {selectedEp} {zetSlug && `• ${zetSlug}`}
          {inWebView && " • 📱 APK"}
        </p>

        {/* Idioma: solo cambia si hay 2+ Z servers o latino HLS */}
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          {hasMultipleLangs ? (
            <button
              onClick={() => setLang(lang === "sub" ? "latino" : "sub")}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-all flex items-center gap-1.5"
            >
              {langButtonLabel}
              <span className="text-[10px] opacity-80">
                ({lang === "sub" ? "🇯🇵 JP → 🌎 LAT" : "🌎 LAT → 🇯🇵 JP"})
              </span>
            </button>
          ) : (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground">
              {langButtonLabel}
            </span>
          )}
        </div>

        {lang === "latino" && latinoEp && (
          <div className="flex items-center gap-2 bg-green-600/10 border border-green-600/30 rounded-xl px-4 py-2 mb-4">
            <span className="text-xs text-green-400 font-medium">✓ HLS Latino disponible</span>
          </div>
        )}

        {serverError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{(serverError as Error)?.message || "Error al obtener servidores"}</p>
          </div>
        )}

        {/* Servers info */}
        {sortedSources.length > 0 && (
          <p className="text-[10px] text-muted-foreground mb-2">
            {sortedSources.length} servidor{sortedSources.length > 1 ? "es" : ""} disponible{sortedSources.length > 1 ? "s" : ""}
          </p>
        )}

        {/* Report broken link */}
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

        {/* Debug */}
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

      {/* Episodes grid */}
      <div className="px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Episodios</h2>
        {episodeNumbers.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {episodeNumbers.map((epNum) => {
              const isActive = epNum === selectedEp;
              const epSlug = zetSlug ? `${zetSlug}-${epNum}` : "";
              const watched = epSlug ? isEpisodeWatched(epSlug) : false;
              return (
                <div key={epNum} className={`flex rounded-lg overflow-hidden transition-all ${isActive ? "ring-2 ring-primary/50" : ""}`}>
                  <button onClick={() => selectEpisode(epNum)}
                    className={`flex-1 py-2.5 px-3 text-sm font-bold transition-all text-left ${isActive ? "bg-primary text-primary-foreground" : watched ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                    EP {epNum}
                  </button>
                  <button onClick={() => toggleWatched(epNum)}
                    className={`w-[30%] flex items-center justify-center transition-all border-l border-background/20 ${watched ? "bg-primary text-primary-foreground" : "bg-secondary/80 text-muted-foreground hover:text-primary"}`}>
                    {watched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Cargando episodios...</p>
        )}
      </div>
    </div>
  );
}
