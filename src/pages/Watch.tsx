import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  resolveSlugFromTitle, getEpisodeServers, sortServersByPriority,
  isEpisodeWatched, detectAdblock, titleToSlug,
  type ZetServer,
} from "@/lib/zetapi";
import { getAnimeById, getTitle } from "@/lib/anilist";
import {
  Eye, Server, ChevronLeft, Loader2, AlertCircle, MonitorPlay,
  ExternalLink, Globe, RefreshCw, ShieldAlert, Bug, Play, ChevronDown,
} from "lucide-react";

const ZET_BASE = "https://zetapi-api.samvelzeta.workers.dev/api";

type Lang = "sub" | "latino";

export default function Watch() {
  const { id } = useParams<{ id: string }>();
  const anilistId = Number(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const epParam = Number(searchParams.get("ep") || 1);

  const [selectedEp, setSelectedEp] = useState(epParam);
  const [selectedServer, setSelectedServer] = useState<ZetServer | null>(null);
  const [currentServerIndex, setCurrentServerIndex] = useState(0);
  const [sortedServers, setSortedServers] = useState<ZetServer[]>([]);
  const [lang, setLang] = useState<Lang>("sub");
  const [adblockDetected, setAdblockDetected] = useState(false);
  const [allFailed, setAllFailed] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [playerActive, setPlayerActive] = useState(false);
  const [useProxy, setUseProxy] = useState(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => { detectAdblock().then(setAdblockDetected); }, []);

  const { data: anilistData } = useQuery({
    queryKey: ["anime-detail", anilistId],
    queryFn: () => getAnimeById(anilistId),
    enabled: anilistId > 0,
    staleTime: 1000 * 60 * 10,
  });

  const animeTitle = anilistData ? (anilistData.title?.romaji || anilistData.title?.english || "") : "";

  const { data: zetSlug, isLoading: loadingSlug } = useQuery({
    queryKey: ["zet-slug", animeTitle],
    queryFn: async () => {
      const slug = await resolveSlugFromTitle(animeTitle);
      if (slug) return slug;
      return titleToSlug(animeTitle);
    },
    enabled: !!animeTitle,
    staleTime: 1000 * 60 * 10,
    retry: 1,
  });

  const totalEpisodes = anilistData?.episodes || 0;
  const episodeNumbers = Array.from({ length: Math.max(totalEpisodes, selectedEp) }, (_, i) => i + 1);

  const { data: serverData, isLoading: loadingServers, error: serverError } = useQuery({
    queryKey: ["zet-servers", zetSlug, selectedEp, lang],
    queryFn: async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      try {
        const res = await getEpisodeServers(zetSlug!, selectedEp, lang);
        return res;
      } finally {
        clearTimeout(timeout);
      }
    },
    enabled: !!zetSlug,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  useEffect(() => {
    if (!serverData?.servers?.length) {
      setSortedServers([]); setSelectedServer(null); setAllFailed(false);
      return;
    }
    const sorted = sortServersByPriority(serverData.servers);
    setSortedServers(sorted);
    setCurrentServerIndex(0);
    setAllFailed(false);
    setIframeLoaded(false);
    setPlayerActive(false);
    setUseProxy(false); // Start with direct embed
    if (sorted.length > 0) {
      setSelectedServer(sorted[0]);
    } else setSelectedServer(null);
  }, [serverData]);

  useEffect(() => {
    return () => { if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current); };
  }, []);

  const startFallbackTimer = useCallback((servers: ZetServer[], idx: number, isProxy: boolean) => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    fallbackTimerRef.current = setTimeout(() => {
      if (!iframeLoaded) {
        if (!isProxy) {
          // Direct embed failed → try same server via proxy
          setUseProxy(true);
          startFallbackTimer(servers, idx, true);
        } else {
          // Proxy also failed → try next server direct
          const next = idx + 1;
          if (next >= servers.length) { setAllFailed(true); return; }
          setCurrentServerIndex(next);
          setSelectedServer(servers[next]);
          setIframeLoaded(false);
          setUseProxy(false);
          startFallbackTimer(servers, next, false);
        }
      }
    }, 5000);
  }, [iframeLoaded]);

  const tryNextServer = useCallback(() => {
    const next = currentServerIndex + 1;
    if (next >= sortedServers.length) { setAllFailed(true); return; }
    setCurrentServerIndex(next);
    setSelectedServer(sortedServers[next]);
    setIframeLoaded(false);
    setUseProxy(false); // Try direct first
    setPlayerActive(true);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    startFallbackTimer(sortedServers, next, false);
  }, [currentServerIndex, sortedServers, startFallbackTimer]);

  const selectServer = (server: ZetServer, idx: number) => {
    setCurrentServerIndex(idx);
    setSelectedServer(server);
    setAllFailed(false);
    setIframeLoaded(false);
    setPlayerActive(true);
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
  };

  const selectEpisode = (epNumber: number) => {
    setSelectedEp(epNumber);
    setSelectedServer(null);
    setAllFailed(false);
    setIframeLoaded(false);
    setPlayerActive(false);
    setSearchParams({ ep: String(epNumber) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openExternal = () => {
    if (selectedServer?.embed) window.open(selectedServer.embed, "_blank");
    else if (sortedServers[0]?.embed) window.open(sortedServers[0].embed, "_blank");
  };

  const activatePlayer = () => {
    setPlayerActive(true);
    startFallbackTimer(sortedServers, currentServerIndex, useProxy);
  };

  // Try direct embed first, proxy as fallback
  const iframeSrc = selectedServer?.embed
    ? useProxy
      ? `${ZET_BASE}/proxy?url=${encodeURIComponent(selectedServer.embed)}`
      : selectedServer.embed
    : null;

  const displayTitle = anilistData ? getTitle(anilistData) : "Cargando...";

  return (
    <div className="min-h-screen pb-24">
      <div className="px-4 pt-4 pb-2">
        <Link to={`/anime/${id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
          <ChevronLeft className="w-4 h-4" /> Volver al anime
        </Link>
      </div>

      {adblockDetected && (
        <div className="mx-4 mb-3 flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl px-4 py-3">
          <ShieldAlert className="w-4 h-4 text-yellow-500 flex-shrink-0" />
          <p className="text-xs text-yellow-500">Desactiva tu AdBlock para que los servidores de video carguen correctamente.</p>
        </div>
      )}

      {/* Player */}
      <div className="px-4 mb-4">
        {(loadingServers || loadingSlug) ? (
          <div className="aspect-video bg-secondary rounded-xl flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : allFailed ? (
          <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center px-4">Todos los servidores fallaron</p>
            <div className="flex gap-2">
              <button onClick={openExternal} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition">
                <ExternalLink className="w-4 h-4" /> Abrir directo
              </button>
              <button onClick={() => { setAllFailed(false); setCurrentServerIndex(0); setSelectedServer(sortedServers[0]); setPlayerActive(false); }}
                className="flex items-center gap-2 px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition">
                <RefreshCw className="w-4 h-4" /> Reintentar
              </button>
            </div>
          </div>
        ) : iframeSrc && !playerActive ? (
          /* Click to play overlay */
          <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer group" onClick={activatePlayer}>
            <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Play className="w-8 h-8 text-primary-foreground fill-current ml-1" />
            </div>
            <p className="text-sm text-muted-foreground">Clic para reproducir — {selectedServer?.name}</p>
          </div>
        ) : iframeSrc && playerActive ? (
          <div className="aspect-video bg-black rounded-xl overflow-hidden relative">
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </div>
            )}
            {/* Transparent overlay to block popup clicks */}
            <div className="absolute inset-0 z-[5]" style={{ pointerEvents: iframeLoaded ? "none" : "auto" }} />
            <iframe
              key={iframeSrc}
              src={iframeSrc}
              className="w-full h-full border-0 relative z-[1]"
              allowFullScreen
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              title={`${displayTitle} - EP ${selectedEp}`}
              onLoad={() => { setIframeLoaded(true); if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current); }}
              onError={() => tryNextServer()}
            />
          </div>
        ) : (
          <div className="aspect-video bg-secondary rounded-xl flex flex-col items-center justify-center gap-3">
            <MonitorPlay className="w-12 h-12 text-muted-foreground" />
            <p className="text-sm text-muted-foreground text-center px-4">
              {serverError ? "Error al cargar servidores." : !zetSlug ? "Buscando anime..." : "Selecciona un episodio"}
            </p>
          </div>
        )}
      </div>

      {/* Title + controls */}
      <div className="px-4 mb-4">
        <h1 className="text-base font-bold text-foreground mb-1">{displayTitle}</h1>
        <p className="text-xs text-muted-foreground mb-3">Episodio {selectedEp} {zetSlug && `• ${zetSlug}`}</p>

        {/* Language */}
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Idioma:</span>
          {(["sub", "latino"] as Lang[]).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${lang === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
              {l === "sub" ? "🇯🇵 Japonés" : "🌎 Latino"}
            </button>
          ))}
        </div>

        {/* Servers */}
        {sortedServers.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Server className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Servidores ({sortedServers.length})</span>
              {iframeSrc && (
                <button onClick={tryNextServer} className="ml-auto flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition">
                  <RefreshCw className="w-3 h-3" /> Siguiente
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {sortedServers.map((server, idx) => (
                <button key={`${server.name}-${idx}`} onClick={() => selectServer(server, idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedServer?.name === server.name && currentServerIndex === idx ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>
                  {server.name}
                </button>
              ))}
              <button onClick={openExternal} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:bg-muted transition-all flex items-center gap-1">
                <ExternalLink className="w-3 h-3" /> Externo
              </button>
            </div>
          </div>
        )}

        {serverError && (
          <div className="flex items-center gap-2 bg-destructive/10 border border-destructive/30 rounded-xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
            <p className="text-xs text-destructive">{(serverError as Error)?.message || "Error al obtener servidores"}</p>
          </div>
        )}

        {/* Debug panel */}
        <button onClick={() => setShowDebug(!showDebug)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition mb-2">
          <Bug className="w-3.5 h-3.5" />
          Debug
          <ChevronDown className={`w-3 h-3 transition-transform ${showDebug ? "rotate-180" : ""}`} />
        </button>
        {showDebug && (
          <div className="bg-secondary/50 border border-border rounded-xl p-3 mb-4 text-[10px] font-mono space-y-1">
            <p><span className="text-primary">slug:</span> {zetSlug || "—"}</p>
            <p><span className="text-primary">episode:</span> {selectedEp}</p>
            <p><span className="text-primary">lang:</span> {lang}</p>
            <p><span className="text-primary">servers:</span> {sortedServers.length}</p>
            <p><span className="text-primary">current:</span> {selectedServer?.name || "—"} (#{currentServerIndex})</p>
            <p><span className="text-primary">iframe:</span> {iframeLoaded ? "✅ loaded" : "⏳ loading"}</p>
            <p><span className="text-primary">allFailed:</span> {allFailed ? "❌ yes" : "✅ no"}</p>
            <p><span className="text-primary">mode:</span> {useProxy ? "🔄 proxy" : "⚡ directo"}</p>
            <p><span className="text-primary">src:</span> <span className="break-all">{iframeSrc || "—"}</span></p>
            {serverData && (
              <details className="mt-2">
                <summary className="text-primary cursor-pointer">Raw JSON</summary>
                <pre className="mt-1 max-h-40 overflow-auto text-muted-foreground whitespace-pre-wrap">
                  {JSON.stringify(serverData, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
      </div>

      {/* Episodes grid */}
      <div className="px-4">
        <h2 className="text-sm font-bold text-foreground mb-3">Episodios</h2>
        {episodeNumbers.length > 0 ? (
          <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-12 gap-2">
            {episodeNumbers.map((epNum) => {
              const isActive = epNum === selectedEp;
              const epSlug = zetSlug ? `${zetSlug}-${epNum}` : "";
              const isWatched = epSlug ? isEpisodeWatched(epSlug) : false;
              return (
                <button key={epNum} onClick={() => selectEpisode(epNum)}
                  className={`relative aspect-square rounded-lg text-sm font-bold transition-all flex items-center justify-center ${isActive ? "bg-primary text-primary-foreground ring-2 ring-primary/50" : isWatched ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  {epNum}
                  {isWatched && <Eye className="absolute top-0.5 right-0.5 w-2.5 h-2.5 text-primary" />}
                </button>
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
