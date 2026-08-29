import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, Check, AlertCircle, Send, Film, Edit3, Trash2, Wand2 } from "lucide-react";
import { Input } from "@/components/ui/input";

import { searchAnime, type AniListMedia, getTitle } from "@/lib/anilist";
import { clearSeekeEpisodeCache, titleToSlug } from "@/lib/zetapi";
import {
  saveCachedVideo,
  getCachedVideo,
  deleteCachedVideo,
  listCachedVideosBySlug,
  type CachedVideo,
  clearRuntimeVideoCache,
} from "@/lib/video-cache";
import { getSlugOverride } from "@/lib/slug-overrides";
import { invalidateStreamCache } from "@/lib/stream-cache";
import { clearSeekeMasterCache } from "@/lib/anime-prequels";
import { clearDubbedCache } from "@/hooks/useDubbedAnimes";
import { approveAnime } from "@/lib/approved-animes";
import { logAdminActivity } from "@/lib/admin-log";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import BlocksEditor from "./BlocksEditor";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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

async function ensureTrackerCompleted(params: {
  anilistId: number;
  title: string;
  cover?: string | null;
  totalEpisodes?: number | null;
  airingStatus?: string | null;
}) {
  try {
    await supabase.from("anime_download_tracker").upsert({
      anilist_id: params.anilistId,
      title: params.title,
      cover_image: params.cover ?? null,
      total_episodes: params.totalEpisodes ?? 0,
      status: "completed",
      airing_status: params.airingStatus ?? null,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: "anilist_id" });
  } catch (err) {
    console.warn("[tracker] auto-completed upsert failed", err);
  }
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
  const [approvingSlug, setApprovingSlug] = useState(false);
  const [autoFetching, setAutoFetching] = useState(false);
  const [autoLog, setAutoLog] = useState<string[]>([]);
  const [pendingDelete, setPendingDelete] = useState<CachedVideo | null>(null);
  

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
        // Normaliza y tokeniza la query en palabras >=2 letras
        const normalize = (s: string) =>
          (s || "")
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9\s]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        const queryNorm = normalize(val);
        const tokens = queryNorm.split(" ").filter((t) => t.length >= 2);

        // Una sola llamada con el término completo: AniList ya matchea títulos parciales
        // (romaji/english/native/synonyms) y evita 429 por spam de queries paralelas.
        // Si no encuentra nada, reintentamos con el primer token como fallback (ej: "naruto" desde "naruto shipuden").
        const seen = new Map<number, AniListMedia>();
        const primary = await searchAnime(val, 1, 30, [], { skipCuration: true, includeAdult: true }).catch(() => null);
        for (const m of primary?.media || []) if (!seen.has(m.id)) seen.set(m.id, m);
        if (seen.size === 0 && tokens[0] && tokens[0] !== queryNorm) {
          const fb = await searchAnime(tokens[0], 1, 30, [], { skipCuration: true, includeAdult: true }).catch(() => null);
          for (const m of fb?.media || []) if (!seen.has(m.id)) seen.set(m.id, m);
        }
        const pool = Array.from(seen.values());

        // Similitud por bigramas (Dice) — tolera errores tipográficos.
        const bigrams = (s: string) => {
          const set = new Set<string>();
          for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
          return set;
        };
        const dice = (a: string, b: string) => {
          if (!a || !b) return 0;
          if (a === b) return 1;
          const A = bigrams(a), B = bigrams(b);
          if (!A.size || !B.size) return 0;
          let inter = 0;
          A.forEach((x) => { if (B.has(x)) inter++; });
          return (2 * inter) / (A.size + B.size);
        };

        // Scoring flexible: substring, prefijo, similitud y coincidencia parcial de tokens.
        const scored = pool
          .map((m) => {
            const titles = [
              (m as any).title?.romaji,
              (m as any).title?.english,
              (m as any).title?.native,
              ...(((m as any).synonyms as string[]) || []),
            ]
              .filter(Boolean)
              .map((t: string) => normalize(t));
            const hay = titles.join(" | ");
            let score = 0;
            if (tokens.length) {
              let hits = 0;
              for (const t of tokens) {
                if (hay.includes(t)) hits += 1;
                else if (t.length >= 4 && titles.some((tt) => dice(tt, t) >= 0.5)) hits += 0.5;
              }
              score += hits / tokens.length;
            }
            if (queryNorm && hay.includes(queryNorm)) score += 0.8;
            if (titles.some((t) => t.startsWith(queryNorm))) score += 0.5;
            const bestSim = titles.reduce((mx, t) => Math.max(mx, dice(t, queryNorm)), 0);
            score += bestSim * 0.9;
            return { m, score };
          })
          // Umbral bajo → muchas sugerencias relacionadas
          .filter((x) => x.score >= 0.15)
          .sort((a, b) => b.score - a.score);

        const media = scored.map((x) => x.m).slice(0, 40);
        setSearchResults(media);
        if (media.length === 0) {
          console.warn("[VideoManager] búsqueda sin resultados", { term: val, pool: pool.length });
          toast.info(`Sin resultados para "${val}"`);
        }
      } catch (e: any) {
        console.error("[VideoManager] error de búsqueda", e);
        toast.error(`Error de búsqueda: ${e?.message || "desconocido"}`);
        setSearchResults([]);
      }
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
    // Keep search query/results so closing the anime returns to the search
    setSelectedEp(null);
    setEpStatuses({});
    setVisibleRange({ start: 0, end: 50 });
    if (override) toast.success(`Usando slug manual: ${override}`);
    // Cargar enlaces oficiales ya guardados de DB
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

  // Preselección desde otras páginas del admin (ej. "Pendientes de aprobación")
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("admin:preselect-anime");
      if (!raw) return;
      sessionStorage.removeItem("admin:preselect-anime");
      const info = JSON.parse(raw) as { id: number; title: string; cover?: string; episodes?: number; lang?: "sub" | "latino" };
      if (!info?.id || !info?.title) return;
      (async () => {
        const override = await getSlugOverride(info.id);
        const slug = override || titleToSlug(info.title);
        setSelected({
          id: info.id,
          title: info.title,
          slug,
          cover: info.cover || "",
          totalEpisodes: info.episodes || 24,
        });
        if (info.lang) setLang(info.lang);
        const saved = await listCachedVideosBySlug(slug, info.id);
        setSavedVideos(saved);
        toast.success(`Anime cargado: ${info.title}`);
      })();
    } catch (e) {
      console.warn("[VideoManager] preselect failed", e);
    }
  }, []);


  const checkEpisode = useCallback(async (slug: string, ep: number, l: string) => {
    const key = `${ep}-${l}`;
    // Primero check en nuestra DB oficial (más rápido y confiable)
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
      // 1. Guardar en Lovable Cloud (DB) — fuente oficial compartida para todos
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
          .neq("episode", 0)
          .is("sources->seeke", null);
        if (wipeError && !String(wipeError.message || "").includes("Protected Seeke")) throw wipeError;
        clearRuntimeVideoCache();
        clearSeekeEpisodeCache();
        clearSeekeMasterCache();
    clearDubbedCache();
      await invalidateStreamCache(selected.id);
        clearProgress();
        setEpStatuses({});
        // ⇢ Sincroniza tracker: si no existe, se crea y queda en "completed".
        await ensureTrackerCompleted({
          anilistId: selected.id,
          title: selected.title,
          cover: selected.cover,
          totalEpisodes: selected.totalEpisodes,
        });
      }

      // 2. Guardar también en API externa (si está caída no rompe — DB oficial ya guardó)
      try {
        await fetch(`${API_BASE}/api/admin/save-video`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: selected.slug, episode: selectedEp, lang, sources }),
        });
      } catch (e) {
        console.warn("API externa falló pero DB guardó OK:", e);
      }

      toast.success(isSeekeBase ? `URL madre Seeke ${lang} guardada como enlace oficial` : `EP ${selectedEp} guardado como enlace oficial`);
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
    setAutoLog([`Guardando URL madre oficial · ${selected.title} · ${lang}`]);

    // Guardar SOLO URL madre Seeke (episode=0) — enlace oficial universal.
    // No se generan episodios resueltos porque eso era cache y podía repetir videos.
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

    const { error: wipeError } = await supabase
      .from("video_cache")
      .delete()
      .eq("anilist_id", selected.id)
      .eq("lang", lang)
      .neq("episode", 0)
      .is("sources->seeke", null);
    if (wipeError) {
      setAutoLog((prev) => [`Aviso: no se pudieron limpiar episodios resueltos: ${wipeError.message}`, ...prev].slice(0, 12));
    }

    // Auto-registrar en tracker como "completed" apenas queda el enlace madre.
    await ensureTrackerCompleted({
      anilistId: selected.id,
      title: selected.title,
      cover: selected.cover,
      totalEpisodes: selected.totalEpisodes,
    });

    clearRuntimeVideoCache();
    clearSeekeEpisodeCache();
    clearSeekeMasterCache();
    clearDubbedCache();
      await invalidateStreamCache(selected.id);
    clearProgress();
    setEpStatuses({});
    setAutoLog((prev) => ["✔ URL madre guardada; reproducción hará peticiones directas a la VPS", ...prev].slice(0, 12));
    const refreshed = await listCachedVideosBySlug(selected.slug, selected.id);
    setSavedVideos(refreshed);
    setAutoFetching(false);
  };

    // Limpieza legacy: eliminado el borrado global y por-anime. Los enlaces Seeke
  // solo se pueden reemplazar/eliminar individualmente desde "Ver guardados"
  // para no dejar toda la app sin fuentes de video.



  // Aprueba el anime SOLO con slug (sin enlace Seeke). El player resolverá los
  // episodios vía zetapi de Cloudflare y queda registrado en Descargas.
  const approveWithSlug = async () => {
    if (!selected) return;
    if (!selected.slug) return toast.error("El anime no tiene slug");
    setApprovingSlug(true);
    try {
      const { error: slugErr } = await supabase.from("slugs" as any).upsert({
        anilist_id: selected.id,
        slug: selected.slug,
        manual_slug: selected.slug,
        title: selected.title,
        cover_image: selected.cover || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "anilist_id" });
      if (slugErr) throw slugErr;

      const res = await approveAnime(selected.id, `slug:${selected.slug}`);
      if (!res.success) throw new Error(res.error || "No se pudo aprobar");

      await ensureTrackerCompleted({
        anilistId: selected.id,
        title: selected.title,
        cover: selected.cover,
        totalEpisodes: selected.totalEpisodes,
      });
      clearSeekeMasterCache();
    clearDubbedCache();
      await invalidateStreamCache(selected.id);
      await logAdminActivity({
        area: "videos",
        action: "approve_anime_by_slug",
        summary: `Aprobado por slug desde Videos: ${selected.title} (${selected.slug})`,
        target_type: "anime",
        target_id: String(selected.id),
        anilist_id: selected.id,
        anime_title: selected.title,
        metadata: { slug: selected.slug },
      });
      toast.success(`Aprobado con slug: ${selected.slug}`);
    } catch (e: any) {
      toast.error("Error al aprobar por slug: " + (e?.message || "desconocido"));
    } finally {
      setApprovingSlug(false);
    }
  };

  const editSaved = (sv: CachedVideo) => {
    setSelectedEp(sv.episode === 0 ? 1 : sv.episode);
    setLang(sv.lang as "sub" | "latino");
    // Pre-fill URLs from the saved entry for editing
    const allUrls = [
      ...(sv.sources?.seeke || []),
      ...(sv.sources?.hls || []),
      ...(sv.sources?.mp4 || []),
      ...(sv.sources?.embed || []),
    ];
    setPrimaryUrl(allUrls[0] || "");
    setFallbackUrl(allUrls[1] || "");
    setPcUrl(sv.sources?.pc?.[0] || "");
    setMobileUrl(sv.sources?.mobile?.[0] || "");
    setShowSaved(false);
  };

  const deleteSaved = async (sv: CachedVideo) => {
    const label = sv.episode === 0 ? "enlace madre" : `EP ${sv.episode}`;
    if (!confirm(`¿Eliminar ${label} (${sv.lang}) de la DB? Esta acción no se puede deshacer.`)) return;
    const res = await deleteCachedVideo(sv.slug, sv.episode, sv.lang, sv.id);
    if (!res.success) {
      toast.error("Error al eliminar: " + (res.error || "desconocido"));
      return;
    }
    toast.success(`${label} eliminado`);
    setSavedVideos(prev => prev.filter(v => v.id !== sv.id));
    const key = `${sv.episode}-${sv.lang}`;
    setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: false } }));
    if (selectedEp === sv.episode && lang === sv.lang) {
      setPrimaryUrl("");
      setFallbackUrl("");
    }
    // If madre was deleted, clear runtime caches
    if (sv.episode === 0 || hasSeekeSource(sv.sources)) {
      clearRuntimeVideoCache();
      clearSeekeEpisodeCache();
      clearSeekeMasterCache();
    clearDubbedCache();
      await invalidateStreamCache(selected?.id || sv.anilist_id || 0);
    }
  };




  const totalEps = selected?.totalEpisodes || 0;

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Film className="w-4 h-4 text-primary" /> Gestor de Videos
        </h3>
        <p className="text-[10px] text-muted-foreground">
          Busca anime → episodio → URL. Se guarda como enlace oficial en Lovable Cloud + tu API. Para reemplazar un enlace Seeke, edítalo desde "Ver guardados" del anime.
        </p>
      </div>

      {selected ? (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-secondary rounded-xl p-3 border border-primary/30">
          {selected.cover && <img src={selected.cover} alt="" className="w-10 h-14 rounded object-cover flex-shrink-0" />}
          <div className="flex-1 min-w-[140px]">
            <p className="text-sm font-bold text-foreground leading-tight line-clamp-2 break-words">{selected.title}</p>
            <p className="text-[10px] text-muted-foreground font-mono break-all whitespace-normal leading-tight">
              {selected.slug}
            </p>
            <p className="text-[10px] text-muted-foreground">{totalEps} eps · {savedVideos.length} guardados</p>
          </div>
          <button
            onClick={approveWithSlug}
            disabled={approvingSlug}
            title="Aprobar este anime usando su slug (sin enlace Seeke). El player resolverá por zetapi Cloudflare."
            className="h-8 px-3 rounded-lg bg-orange-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-orange-500 disabled:opacity-50 flex-shrink-0"
          >
            {approvingSlug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Aprobar con Slug
          </button>
          <button onClick={() => setShowSaved(!showSaved)} className="text-xs text-primary hover:underline px-2 flex-shrink-0">
            {showSaved ? "Ocultar" : "Ver guardados"}
          </button>
          <button onClick={() => { setSelected(null); setSelectedEp(null); setEpStatuses({}); setSavedVideos([]); setShowSaved(false); }} className="text-muted-foreground hover:text-destructive flex-shrink-0">
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
                    <p className="text-xs font-bold text-foreground leading-tight line-clamp-2 break-words">{getTitle(anime)}</p>
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
            <p className="text-[10px] font-bold text-primary mb-2">ENLACES OFICIALES EN DB</p>
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

      {selected && (
        <BlocksEditor anilistId={selected.id} slug={selected.slug} lang={lang} />
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
            className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-[11px] break-all"
          />
          <p className="text-[10px] text-muted-foreground mt-1 break-words">
            Este slug debe coincidir EXACTAMENTE con el del sitio fuente. Los videos se guardan bajo este slug.
          </p>
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-3 sm:h-[400px] sm:flex-row">
          <div className="w-full sm:w-1/3 flex flex-col gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={totalEps}
                placeholder={`Ir al capítulo… (1-${totalEps})`}
                className="h-8 pl-8 bg-secondary border-primary/30 rounded-lg text-xs"
                onChange={(e) => {
                  const ep = parseInt(e.target.value, 10);
                  if (!Number.isFinite(ep) || ep < 1 || ep > totalEps) return;
                  setSelectedEp(ep);
                  if (listRef.current) {
                    listRef.current.scrollTo({ top: Math.max(0, (ep - 1) * 40 - 80), behavior: "smooth" });
                  }
                }}
              />
            </div>
            <div ref={listRef} onScroll={handleScroll}
              className="h-56 w-full overflow-y-auto border border-border rounded-xl bg-secondary/30 sm:h-auto sm:flex-1"
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
                  </div>
                );
              })}
            </div>
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
                  Guardar EP {selectedEp} oficial
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
