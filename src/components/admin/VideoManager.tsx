import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, Check, AlertCircle, Send, Film, Edit3, Trash2, Wand2, Database } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAnime, type AniListMedia, getTitle } from "@/lib/anilist";
import { clearSeekeEpisodeCache, getSeekeEpisode, titleToSlug } from "@/lib/zetapi";
import { saveCachedVideo, getCachedVideo, deleteCachedVideo, listCachedVideosBySlug, type CachedVideo, clearRuntimeVideoCache } from "@/lib/video-cache";
import { getSlugOverride } from "@/lib/slug-overrides";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const API_BASE = "https://zetapi-api.samvelzeta.workers.dev";

interface SelectedAnime {
  id: number;
  title: string;
  slug: string;
  cover: string;
  totalEpisodes: number;
}

interface EpisodeStatus {
  checked: boolean;
  exists: boolean;
}

const STORAGE_KEY = "upload-progress";

function normalizeSeekeBaseUrl(url: string) {
  return url.trim();
}

function hasSeekeSource(sources?: CachedVideo["sources"]) {
  return (sources?.seeke?.length || 0) > 0;
}

function getStoredProgress(): Record<string, Record<string, Record<string, string>>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch { return {}; }
}

function saveProgress(slug: string, lang: string, episode: number, url: string) {
  const data = getStoredProgress();
  if (!data[slug]) data[slug] = {};
  if (!data[slug][lang]) data[slug][lang] = {};
  data[slug][lang][String(episode)] = url;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function getProgress(slug: string, lang: string, episode: number): string {
  const data = getStoredProgress();
  return data[slug]?.[lang]?.[String(episode)] || "";
}

function clearProgress(slug?: string, lang?: string, episode?: number) {
  if (!slug || !lang || episode == null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const data = getStoredProgress();
  delete data[slug]?.[lang]?.[String(episode)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export default function VideoManager() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedAnime | null>(null);
  const [selectedEp, setSelectedEp] = useState<number | null>(null);
  const [lang, setLang] = useState<"sub" | "latino">("sub");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [pcUrl, setPcUrl] = useState("");
  const [mobileUrl, setMobileUrl] = useState("");
  const [epStatuses, setEpStatuses] = useState<Record<string, EpisodeStatus>>({});
  const [sending, setSending] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const [savedVideos, setSavedVideos] = useState<CachedVideo[]>([]);
  const [showSaved, setShowSaved] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoLog, setAutoLog] = useState<string[]>([]);
  const [deletingEp, setDeletingEp] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const listRef = useRef<HTMLDivElement>(null);
  const stopAutoFetchRef = useRef(false);

  const handleSearch = (val: string) => {
    setSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (val.length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchAnime(val, 1, 10);
        setSearchResults(res.media || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 400);
  };

  const selectAnime = async (anime: AniListMedia) => {
    // Prioridad: slug override manual (si existe) > slug calculado del título
    const override = await getSlugOverride(anime.id);
    const slug = override || titleToSlug(anime.title?.romaji || anime.title?.english || "");
    setSelected({
      id: anime.id,
      title: getTitle(anime),
      slug,
      cover: anime.coverImage?.large || anime.coverImage?.extraLarge || "",
      totalEpisodes: anime.episodes || 24,
    });
    setSearchQuery("");
    setSearchResults([]);
    setSelectedEp(null);
    setEpStatuses({});
    setVisibleRange({ start: 0, end: 50 });
    if (override) toast.success(`Usando slug manual: ${override}`);
    // Cargar videos ya guardados de DB
    const saved = await listCachedVideosBySlug(slug, anime.id);
    setSavedVideos(saved);
  };

  // Permite al admin editar el slug del anime seleccionado (sincroniza con override)
  const updateSlug = async (newSlug: string) => {
    if (!selected) return;
    const clean = newSlug.trim().toLowerCase();
    setSelected({ ...selected, slug: clean });
    setEpStatuses({});
    const saved = await listCachedVideosBySlug(clean, selected.id);
    setSavedVideos(saved);
  };

  const checkEpisode = useCallback(async (slug: string, ep: number, l: string) => {
    const key = `${ep}-${l}`;
    // Primero check en nuestra DB (más rápido y confiable)
    const cached = await getCachedVideo(slug, ep, l, selected?.id);
    if (cached) {
      setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: true } }));
      return;
    }
    // Después check en API externa
    try {
      const res = await fetch(`${API_BASE}/api/admin/check-video?slug=${slug}&episode=${ep}&lang=${l}`);
      const data = await res.json();
      setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: data.exists === true } }));
    } catch {
      setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: false } }));
    }
  }, [selected?.id]);

  // Cargar saved al cambiar de ep o lang (auto-rellenar URLs)
  useEffect(() => {
    if (selected && selectedEp !== null) {
      (async () => {
        const cached = await getCachedVideo(selected.slug, selectedEp, lang, selected.id);
        if (cached) {
          const all = [
            ...(cached.sources.seeke || []),
            ...(cached.sources.pc || []),
            ...(cached.sources.mobile || []),
            ...(cached.sources.hls || []),
            ...(cached.sources.mp4 || []),
            ...(cached.sources.embed || []),
          ];
          setPrimaryUrl(all[0] || "");
          setFallbackUrl(all[1] || "");
          setPcUrl(cached.sources.pc?.[0] || "");
          setMobileUrl(cached.sources.mobile?.[0] || "");
        } else {
          const saved = getProgress(selected.slug, lang, selectedEp);
          setPrimaryUrl(saved);
          setFallbackUrl("");
          setPcUrl("");
          setMobileUrl("");
        }
        checkEpisode(selected.slug, selectedEp, lang);
      })();
    }
  }, [selectedEp, lang, selected, checkEpisode]);

  useEffect(() => {
    if (selected && selectedEp !== null && primaryUrl) {
      saveProgress(selected.slug, lang, selectedEp, primaryUrl);
    }
  }, [primaryUrl, selected, selectedEp, lang]);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, clientHeight } = listRef.current;
    const itemH = 40;
    const start = Math.max(0, Math.floor(scrollTop / itemH) - 5);
    const end = Math.min((selected?.totalEpisodes || 0), start + Math.ceil(clientHeight / itemH) + 10);
    setVisibleRange({ start, end });
  };

  // Nota: el chequeo de existencia se hace SOLO cuando el admin pulsa un episodio.
  // No verificamos en background para evitar miles de fetches al hacer scroll.
  // Los episodios YA guardados se muestran en la lista "Ver guardados".

  const buildSourcesObj = (primary: string, fallback: string, pc: string, mobile: string) => {
    const sources: { hls: string[]; mp4: string[]; embed: string[]; pc: string[]; mobile: string[]; seeke: string[] } = { hls: [], mp4: [], embed: [], pc: [], mobile: [], seeke: [] };
    const classify = (url: string) => {
      const normalized = normalizeSeekeBaseUrl(url);
      if (normalized.includes("flixlat.com") || normalized.includes("/detail/") || normalized.includes("123flmsfree.com")) sources.seeke.push(normalized);
      else if (normalized.includes(".m3u8")) sources.hls.push(normalized);
      else if (normalized.includes(".mp4")) sources.mp4.push(normalized);
      else sources.embed.push(normalized);
    };
    if (primary.trim()) classify(primary.trim());
    if (fallback.trim()) classify(fallback.trim());
    if (pc.trim()) sources.pc.push(pc.trim());
    if (mobile.trim()) sources.mobile.push(mobile.trim());
    return sources;
  };

  const sendVideo = async () => {
    if (!selected || selectedEp === null || !primaryUrl.trim()) return toast.error("Falta la URL del video");
    setSending(true);
    const sources = buildSourcesObj(primaryUrl, fallbackUrl, pcUrl, mobileUrl);
    const isSeekeBase = hasSeekeSource(sources);
    const saveEpisode = hasSeekeSource(sources) ? 0 : selectedEp;

    try {
      // 1. Guardar en Lovable Cloud (DB) — fuente confiable
      const dbRes = await saveCachedVideo({
        slug: selected.slug,
        episode: saveEpisode,
        lang,
        sources,
        anilist_id: selected.id,
        anime_title: selected.title,
        uploaded_by: user?.id,
      });
      if (!dbRes.success) {
        toast.error("Error DB: " + (dbRes.error || "desconocido"));
        setSending(false);
        return;
      }

      if (isSeekeBase) {
        const { error: wipeError } = await supabase
          .from("video_cache")
          .delete()
          .eq("anilist_id", selected.id)
          .eq("lang", lang)
          .neq("episode", 0);
        if (wipeError) throw wipeError;
        clearRuntimeVideoCache();
        clearSeekeEpisodeCache();
        clearProgress();
        setEpStatuses({});
      }

      // 2. Guardar también en API externa (si está caída no rompe — DB ya guardó)
      try {
        await fetch(`${API_BASE}/api/admin/save-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: selected.slug, episode: selectedEp, lang, sources }),
        });
      } catch (e) {
        console.warn("API externa falló pero DB guardó OK:", e);
      }

      toast.success(isSeekeBase ? `URL base Seeke ${lang} guardada y capítulos viejos vaciados` : `EP ${selectedEp} guardado correctamente en DB global`);
      const key = `${selectedEp}-${lang}`;
      setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: true } }));
      const refreshed = await listCachedVideosBySlug(selected.slug, selected.id);
      setSavedVideos(refreshed);
    } catch (e: unknown) {
      toast.error("Error: " + (e instanceof Error ? e.message : "desconocido"));
    }
    setSending(false);
  };

  const runSeekeAutoFetch = async () => {
    if (!selected || !primaryUrl.trim()) return toast.error("Falta el link madre de Seeke");
    const sources = buildSourcesObj(primaryUrl, fallbackUrl, pcUrl, mobileUrl);
    if (!hasSeekeSource(sources)) return toast.error("La petición automática solo funciona con URL base Seeke");

    stopAutoFetchRef.current = false;
    setAutoFetching(true);
    setAutoLog([`Iniciando ${selected.title} · ${lang} desde cap 1`]);

    const baseUrl = normalizeSeekeBaseUrl(primaryUrl);
    // 1) Guardar URL base Seeke (episode=0) — sirve como fallback universal
    const saveBase = await saveCachedVideo({
      slug: selected.slug,
      episode: 0,
      lang,
      sources,
      anilist_id: selected.id,
      anime_title: selected.title,
      uploaded_by: user?.id,
    });

    if (!saveBase.success) {
      setAutoLog((prev) => [`Error guardando base: ${saveBase.error || "desconocido"}`, ...prev]);
      setAutoFetching(false);
      return;
    }

    // 2) Bucle: pedir cap N → guardar SOLO en su episode=N (no como fallback del 1)
    for (let ep = 1; ep <= totalEps; ep++) {
      if (stopAutoFetchRef.current) {
        setAutoLog((prev) => [`Detenido por admin en cap ${ep}`, ...prev]);
        break;
      }

      setAutoLog((prev) => [`Pidiendo cap ${ep}...`, ...prev].slice(0, 12));
      try {
        const result = await getSeekeEpisode(baseUrl, ep);
        if (!result.embed) throw new Error("respuesta vacía");

        const isHls = result.embed.includes(".m3u8");
        // Cada cap se guarda EXCLUSIVAMENTE en su slot. NO incluimos seeke aquí
        // (la base ya está en episode=0); así evitamos que el cap 1 termine
        // recibiendo todos los embeds de los demás caps como "servidores alternativos".
        const epSources = {
          hls: isHls ? [result.embed] : [],
          mp4: [],
          embed: isHls ? [] : [result.embed],
          pc: [],
          mobile: [],
          seeke: [],
        };

        const saved = await saveCachedVideo({
          slug: selected.slug,
          episode: ep,
          lang,
          sources: epSources,
          anilist_id: selected.id,
          anime_title: selected.title,
          uploaded_by: user?.id,
        });

        if (!saved.success) throw new Error(saved.error || "no se pudo guardar");

        // Verificación: re-leer del cache para confirmar que SÍ quedó persistido
        // en su episodio correcto (no como fallback del 0).
        clearRuntimeVideoCache();
        const verify = await getCachedVideo(selected.slug, ep, lang, selected.id);
        if (!verify || verify.episode !== ep) {
          throw new Error(`guardado pero no verificado (episode=${verify?.episode ?? "null"})`);
        }

        setEpStatuses((prev) => ({ ...prev, [`${ep}-${lang}`]: { checked: true, exists: true } }));
        setAutoLog((prev) => [`✔ Cap ${ep} guardado en su slot${result.cached ? " (cache)" : ""}`, ...prev].slice(0, 12));

        // Pequeña pausa para no saturar el scraper
        await new Promise((r) => setTimeout(r, 250));
      } catch (e: unknown) {
        setEpStatuses((prev) => ({ ...prev, [`${ep}-${lang}`]: { checked: true, exists: false } }));
        setAutoLog((prev) => [`✘ Cap ${ep}: ${e instanceof Error ? e.message : "error"} — detenido`, ...prev].slice(0, 12));
        break;
      }
    }

    const refreshed = await listCachedVideosBySlug(selected.slug, selected.id);
    setSavedVideos(refreshed);
    setAutoFetching(false);
  };

  // Limpia el cache "basura" (todo lo que NO sea base Seeke). Útil tras pruebas
  // donde se guardaron embeds de otras APIs en animes equivocados. NO toca las
  // URLs base Seeke (episode=0 con sources.seeke), que son las que admin sube.
  const [clearingCache, setClearingCache] = useState(false);
  const clearJunkCache = async () => {
    if (!confirm(
      "¿Eliminar TODO el cache rápido de videos (HLS/MP4/embed por capítulo)?\n\n" +
      "✔ Se MANTIENEN las URLs base Seeke (episode 0).\n" +
      "✘ Se BORRAN todos los caps individuales que se hayan rellenado por auto-fetch o pruebas.\n\n" +
      "Esto es seguro: el reproductor volverá a hacer la petición y guardará de nuevo."
    )) return;
    setClearingCache(true);
    try {
      // Borra todo lo que no sea episode=0 (los seeke base viven en episode=0).
      const { error, count } = await supabase
        .from("video_cache")
        .delete({ count: "exact" })
        .neq("episode", 0);

      if (error) {
        toast.error("Error: " + error.message);
      } else {
        clearRuntimeVideoCache();
        clearSeekeEpisodeCache();
        clearProgress();
        toast.success(`Cache limpiado: ${count ?? 0} registros eliminados`);
        if (selected) {
          const refreshed = await listCachedVideosBySlug(selected.slug, selected.id);
          setSavedVideos(refreshed);
          setEpStatuses({});
        }
      }
    } catch (e) {
      toast.error("Error: " + (e instanceof Error ? e.message : "desconocido"));
    }
    setClearingCache(false);
  };

  const editSaved = (sv: CachedVideo) => {
    setSelectedEp(sv.episode === 0 ? 1 : sv.episode);
    setLang(sv.lang as "sub" | "latino");
    setShowSaved(false);
  };

  const deleteSaved = async (sv: CachedVideo) => {
    if (!confirm(`¿Eliminar EP ${sv.episode} (${sv.lang}) de la DB?`)) return;
    const res = await deleteCachedVideo(sv.slug, sv.episode, sv.lang, sv.id);
    if (!res.success) {
      toast.error("Error al eliminar: " + (res.error || "desconocido"));
      return;
    }
    toast.success(`EP ${sv.episode} eliminado`);
    setSavedVideos(prev => prev.filter(v => v.id !== sv.id));
    const key = `${sv.episode}-${sv.lang}`;
    setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: false } }));
    if (selectedEp === sv.episode && lang === sv.lang) {
      setPrimaryUrl("");
      setFallbackUrl("");
    }
  };

  const deleteEpisodeCache = async (ep: number) => {
    if (!selected) return;
    if (!confirm(`¿Vaciar TODO lo guardado del Cap ${ep} (${lang})?\n\nSe borra el HLS/MP4/embed de ese capítulo para que vuelva a pedirse desde cero. La URL madre Seeke se mantiene.`)) return;
    setDeletingEp(ep);
    try {
      const targets = savedVideos.filter((video) => video.episode === ep && video.lang === lang);
      if (targets.length) {
        const results = await Promise.all(targets.map((video) => deleteCachedVideo(video.slug, video.episode, video.lang, video.id)));
        const failed = results.find((res) => !res.success);
        if (failed) throw new Error(failed.error || "no se pudo borrar");
      } else {
        const res = await deleteCachedVideo(selected.slug, ep, lang);
        if (!res.success) throw new Error(res.error || "no se pudo borrar");
      }

      clearRuntimeVideoCache();
      // Borrar TODOS los caches en memoria/localStorage relacionados a este capítulo
      clearSeekeEpisodeCache(); // limpia mem + todas las keys zet:seeke:*
      try {
        Object.keys(localStorage)
          .filter((key) => key.startsWith("zet:seeke:") && key.endsWith(`:${ep}`))
          .forEach((key) => localStorage.removeItem(key));
      } catch { void 0; }

      setSavedVideos((prev) => prev.filter((video) => !(video.episode === ep && video.lang === lang)));
      setEpStatuses((prev) => ({ ...prev, [`${ep}-${lang}`]: { checked: true, exists: false } }));
      if (selectedEp === ep) {
        setPrimaryUrl("");
        setFallbackUrl("");
        setPcUrl("");
        setMobileUrl("");
      }
      toast.success(`Cap ${ep} vaciado; se pedirá de nuevo desde cero`);
    } catch (e) {
      toast.error("Error: " + (e instanceof Error ? e.message : "desconocido"));
    }
    setDeletingEp(null);
  };

  const totalEps = selected?.totalEpisodes || 0;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Film className="w-4 h-4 text-primary" /> Gestor de Videos
          </h3>
          <p className="text-[10px] text-muted-foreground">
            Busca anime → episodio → URL. Se guarda en DB global (Lovable Cloud) + tu API.
          </p>
        </div>
        <button
          onClick={clearJunkCache}
          disabled={clearingCache}
          className="flex-shrink-0 px-3 py-2 rounded-lg bg-destructive/15 border border-destructive/40 text-destructive font-bold text-[10px] hover:bg-destructive/25 transition flex items-center gap-1.5 disabled:opacity-50"
          title="Borra todos los caps cacheados (NO toca las URLs base Seeke)"
        >
          {clearingCache ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
          Limpiar cache rápido
        </button>
      </div>

      {selected ? (
        <div className="flex items-center gap-3 bg-secondary rounded-xl p-3 border border-primary/30">
          {selected.cover && <img src={selected.cover} alt="" className="w-10 h-14 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{selected.title}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{selected.slug} · {totalEps} eps · {savedVideos.length} guardados en DB</p>
          </div>
          <button onClick={() => setShowSaved(!showSaved)} className="text-xs text-primary hover:underline px-2">
            {showSaved ? "Ocultar" : "Ver guardados"}
          </button>
          <button onClick={() => { setSelected(null); setSelectedEp(null); setEpStatuses({}); setSavedVideos([]); }} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar anime..." className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl" />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
              {searchResults.map((anime) => (
                <button key={anime.id} onClick={() => selectAnime(anime)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition text-left border-b border-border last:border-0">
                  <img src={anime.coverImage?.large || ""} alt="" className="w-8 h-12 rounded object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{getTitle(anime)}</p>
                    <p className="text-[10px] text-muted-foreground">{anime.episodes || "?"} eps · {anime.status}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista de guardados (editar/eliminar) */}
      {selected && showSaved && (
        <div className="bg-secondary/50 rounded-xl border border-primary/30 p-3 space-y-2 max-h-64 overflow-y-auto">
          <p className="text-[10px] font-bold text-primary mb-2">VIDEOS GUARDADOS EN DB</p>
          {savedVideos.length === 0 ? (
            <p className="text-xs text-muted-foreground">No hay videos guardados aún.</p>
          ) : (
            savedVideos.map((sv) => {
              const total =
                (sv.sources?.hls?.length || 0) +
                (sv.sources?.mp4?.length || 0) +
                (sv.sources?.embed?.length || 0) +
                (sv.sources?.seeke?.length || 0);
              return (
                <div key={sv.id} className="flex items-center justify-between bg-background/50 rounded-lg p-2 border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">{sv.episode === 0 ? "Base Seeke" : `EP ${sv.episode}`} · {sv.lang}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{total} fuente{total !== 1 ? "s" : ""}</p>
                  </div>
                  <button onClick={() => editSaved(sv)} className="text-primary hover:bg-primary/10 p-1.5 rounded">
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteSaved(sv)} className="text-destructive hover:bg-destructive/10 p-1.5 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}

      {selected && (
        <div className="flex gap-2">
          {(["sub", "latino"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${lang === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {l === "sub" ? "🇯🇵 Sub" : "🌎 Latino"}
            </button>
          ))}
        </div>
      )}

      {/* Slug editable - útil cuando el slug del scraper no coincide con el calculado */}
      {selected && (
        <div>
          <label className="text-[10px] text-primary mb-1 flex items-center gap-1">
            <Wand2 className="w-3 h-3" /> Slug del scraper (editable)
          </label>
          <Input
            value={selected.slug}
            onChange={(e) => setSelected({ ...selected, slug: e.target.value })}
            onBlur={(e) => updateSlug(e.target.value)}
            placeholder="ej: hunter-x-hunter-2011"
            className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            Este slug debe coincidir EXACTAMENTE con el del sitio fuente. Los videos se guardan bajo este slug.
          </p>
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3 sm:h-[400px] sm:flex-row">
          <div ref={listRef} onScroll={handleScroll}
            className="h-56 w-full overflow-y-auto border border-border rounded-xl bg-secondary/30 sm:h-auto sm:w-1/3"
            style={{ contain: "strict" }}>
            <div style={{ height: `${totalEps * 40}px`, position: "relative" }}>
              {Array.from({ length: visibleRange.end - visibleRange.start }, (_, i) => {
                const ep = visibleRange.start + i + 1;
                if (ep > totalEps) return null;
                const key = `${ep}-${lang}`;
                const status = epStatuses[key];
                const isActive = selectedEp === ep;
                return (
                  <div key={ep}
                    style={{ position: "absolute", top: `${(ep - 1) * 40}px`, height: "40px", left: 0, right: 0 }}
                    className="flex border-b border-border/30">
                    <button onClick={() => setSelectedEp(ep)}
                      className={`flex flex-1 items-center justify-between px-3 text-xs font-medium transition ${
                        isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                      }`}>
                      <span>Cap {ep}</span>
                      {status?.checked && (
                        status.exists
                          ? <Check className="w-3.5 h-3.5 text-primary" />
                          : <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteEpisodeCache(ep)}
                      disabled={deletingEp === ep}
                      className="w-9 shrink-0 border-l border-border/30 text-destructive transition hover:bg-destructive/10 disabled:opacity-50"
                      title={`Vaciar cache del Cap ${ep}`}
                      aria-label={`Vaciar cache del Cap ${ep}`}
                    >
                      {deletingEp === ep ? <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mx-auto h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 space-y-3 pb-28 sm:overflow-y-auto sm:pb-2 sm:pr-1">
            {selectedEp !== null ? (
              <>
                <div className="bg-secondary rounded-xl p-3 border border-border">
                   <p className="text-sm font-bold text-foreground">Capítulo {selectedEp}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.slug} · {lang}</p>
                  {epStatuses[`${selectedEp}-${lang}`]?.checked && (
                    <p className={`text-[10px] font-bold mt-1 ${epStatuses[`${selectedEp}-${lang}`].exists ? "text-primary" : "text-destructive"}`}>
                      {epStatuses[`${selectedEp}-${lang}`].exists ? "✔ Ya cargado" : "✘ Faltante"}
                    </p>
                  )}
                </div>

                <div>
                   <label className="text-[10px] text-primary mb-1 block">URL base Seeke ({lang === "latino" ? "Latino/DUB" : "Japonés/SUB"}) o video principal</label>
                  <Input value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)}
                    placeholder="https://site.com/anime-sub o https://...m3u8" className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Para Seeke pega la URL base del anime/idioma sin /1, /2, etc. Se guarda una sola vez para todos los capítulos.
                  </p>
                </div>

                <div className="grid grid-cols-[auto_auto_1fr] gap-2 items-start bg-secondary/60 rounded-xl border border-primary/30 p-2">
                  <button onClick={runSeekeAutoFetch} disabled={autoFetching || !primaryUrl.trim()}
                    className="px-3 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-[10px] hover:bg-primary/90 transition flex items-center gap-1.5 disabled:opacity-50">
                    {autoFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    Petición automática
                  </button>
                  <button onClick={() => { stopAutoFetchRef.current = true; setAutoLog((prev) => ["Stop solicitado...", ...prev].slice(0, 12)); }} disabled={!autoFetching}
                    className="px-3 py-2 rounded-lg bg-destructive text-destructive-foreground font-bold text-[10px] hover:bg-destructive/90 transition disabled:opacity-50">
                    Stop
                  </button>
                  <div className="min-h-9 max-h-24 overflow-y-auto rounded-lg bg-background/50 border border-border px-2 py-1 font-mono text-[10px] text-muted-foreground">
                    {autoLog.length === 0 ? "Registro automático..." : autoLog.map((line, idx) => (
                      <p key={`${line}-${idx}`} className={line.startsWith("✔") ? "text-primary" : line.startsWith("✘") ? "text-destructive" : ""}>{line}</p>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-primary mb-1 block">Fallback (opcional)</label>
                  <Input value={fallbackUrl} onChange={(e) => setFallbackUrl(e.target.value)}
                    placeholder="https://..." className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
                </div>

                <div>
                  <label className="text-[10px] text-primary mb-1 block">Enlace solo PC (opcional)</label>
                  <Input value={pcUrl} onChange={(e) => setPcUrl(e.target.value)}
                    placeholder="https://..." className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
                </div>

                <div>
                  <label className="text-[10px] text-primary mb-1 block">Enlace solo móvil (opcional)</label>
                  <Input value={mobileUrl} onChange={(e) => setMobileUrl(e.target.value)}
                    placeholder="https://..." className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
                </div>

                <button onClick={sendVideo} disabled={sending || !primaryUrl.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Guardar EP {selectedEp} (DB + API)
                </button>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
                <p>← Selecciona un capítulo</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
