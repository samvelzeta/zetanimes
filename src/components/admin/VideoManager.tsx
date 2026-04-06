import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, X, Check, AlertCircle, Send, Film, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAnime, type AniListMedia, getTitle } from "@/lib/anilist";
import { titleToSlug } from "@/lib/zetapi";
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

export default function VideoManager() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<SelectedAnime | null>(null);
  const [selectedEp, setSelectedEp] = useState<number | null>(null);
  const [lang, setLang] = useState<"sub" | "latino">("sub");
  const [primaryUrl, setPrimaryUrl] = useState("");
  const [fallbackUrl, setFallbackUrl] = useState("");
  const [epStatuses, setEpStatuses] = useState<Record<string, EpisodeStatus>>({});
  const [sending, setSending] = useState(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 50 });
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced search
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

  const selectAnime = (anime: AniListMedia) => {
    const slug = titleToSlug(anime.title?.romaji || anime.title?.english || "");
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
  };

  // Check episode status
  const checkEpisode = useCallback(async (slug: string, ep: number, l: string) => {
    const key = `${ep}-${l}`;
    try {
      const res = await fetch(`${API_BASE}/api/admin/check-video?slug=${slug}&episode=${ep}&lang=${l}`);
      const data = await res.json();
      setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: data.exists === true } }));
    } catch {
      setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: false } }));
    }
  }, []);

  // When selecting episode, restore saved progress
  useEffect(() => {
    if (selected && selectedEp !== null) {
      const saved = getProgress(selected.slug, lang, selectedEp);
      setPrimaryUrl(saved);
      setFallbackUrl("");
      checkEpisode(selected.slug, selectedEp, lang);
    }
  }, [selectedEp, lang, selected, checkEpisode]);

  // Auto-save on URL change
  useEffect(() => {
    if (selected && selectedEp !== null && primaryUrl) {
      saveProgress(selected.slug, lang, selectedEp, primaryUrl);
    }
  }, [primaryUrl, selected, selectedEp, lang]);

  // Virtual scroll
  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, clientHeight } = listRef.current;
    const itemH = 40;
    const start = Math.max(0, Math.floor(scrollTop / itemH) - 5);
    const end = Math.min((selected?.totalEpisodes || 0), start + Math.ceil(clientHeight / itemH) + 10);
    setVisibleRange({ start, end });
  };

  // Batch check visible episodes
  useEffect(() => {
    if (!selected) return;
    const toCheck: number[] = [];
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const ep = i + 1;
      const key = `${ep}-${lang}`;
      if (!epStatuses[key]) toCheck.push(ep);
    }
    // Check in batches of 5
    toCheck.slice(0, 5).forEach(ep => checkEpisode(selected.slug, ep, lang));
  }, [visibleRange, selected, lang, epStatuses, checkEpisode]);

  const sendVideo = async () => {
    if (!selected || selectedEp === null || !primaryUrl.trim()) return toast.error("Falta la URL del video");
    setSending(true);
    try {
      const sources: Record<string, string[]> = {};
      const url = primaryUrl.trim();
      if (url.includes(".m3u8")) sources.hls = [url];
      else if (url.includes(".mp4")) sources.mp4 = [url];
      else sources.embed = [url];

      if (fallbackUrl.trim()) {
        const fb = fallbackUrl.trim();
        if (fb.includes(".m3u8")) sources.hls = [...(sources.hls || []), fb];
        else if (fb.includes(".mp4")) sources.mp4 = [...(sources.mp4 || []), fb];
        else sources.embed = [...(sources.embed || []), fb];
      }

      const res = await fetch(`${API_BASE}/api/admin/save-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: selected.slug,
          episode: selectedEp,
          lang,
          sources,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`EP ${selectedEp} guardado correctamente`);
        const key = `${selectedEp}-${lang}`;
        setEpStatuses(prev => ({ ...prev, [key]: { checked: true, exists: true } }));
      } else {
        toast.error(data.message || "Error al guardar");
      }
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
    setSending(false);
  };

  const totalEps = selected?.totalEpisodes || 0;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Film className="w-4 h-4 text-primary" /> Gestor de Videos
      </h3>
      <p className="text-[10px] text-muted-foreground">
        Busca un anime, selecciona episodio, pega la URL del video y guárdalo en la API.
      </p>

      {/* Search or selected anime */}
      {selected ? (
        <div className="flex items-center gap-3 bg-secondary rounded-xl p-3 border border-primary/30">
          {selected.cover && <img src={selected.cover} alt="" className="w-10 h-14 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{selected.title}</p>
            <p className="text-[10px] text-muted-foreground font-mono">{selected.slug} · {totalEps} eps</p>
          </div>
          <button onClick={() => { setSelected(null); setSelectedEp(null); setEpStatuses({}); }} className="text-muted-foreground hover:text-destructive">
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

      {/* Language selector */}
      {selected && (
        <div className="flex gap-2">
          {(["sub", "latino"] as const).map(l => (
            <button key={l} onClick={() => { setLang(l); setEpStatuses({}); }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition ${lang === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
              {l === "sub" ? "🇯🇵 Sub" : "🌎 Latino"}
            </button>
          ))}
        </div>
      )}

      {/* Episode list - virtualized */}
      {selected && (
        <div className="flex gap-3" style={{ height: "400px" }}>
          {/* Episode list column */}
          <div ref={listRef} onScroll={handleScroll}
            className="w-1/3 overflow-y-auto border border-border rounded-xl bg-secondary/30"
            style={{ contain: "strict" }}>
            <div style={{ height: `${totalEps * 40}px`, position: "relative" }}>
              {Array.from({ length: visibleRange.end - visibleRange.start }, (_, i) => {
                const ep = visibleRange.start + i + 1;
                if (ep > totalEps) return null;
                const key = `${ep}-${lang}`;
                const status = epStatuses[key];
                const isActive = selectedEp === ep;
                return (
                  <button key={ep} onClick={() => setSelectedEp(ep)}
                    style={{ position: "absolute", top: `${(ep - 1) * 40}px`, height: "40px", left: 0, right: 0 }}
                    className={`flex items-center justify-between px-3 text-xs font-medium border-b border-border/30 transition ${
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                    }`}>
                    <span>Cap {ep}</span>
                    {status?.checked && (
                      status.exists
                        ? <Check className="w-3.5 h-3.5 text-green-400" />
                        : <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Episode detail */}
          <div className="flex-1 space-y-3">
            {selectedEp !== null ? (
              <>
                <div className="bg-secondary rounded-xl p-3 border border-border">
                  <p className="text-sm font-bold text-foreground">Capítulo {selectedEp}</p>
                  <p className="text-[10px] text-muted-foreground">{selected.slug} · {lang}</p>
                  {epStatuses[`${selectedEp}-${lang}`]?.checked && (
                    <p className={`text-[10px] font-bold mt-1 ${epStatuses[`${selectedEp}-${lang}`].exists ? "text-green-400" : "text-destructive"}`}>
                      {epStatuses[`${selectedEp}-${lang}`].exists ? "✔ Ya cargado" : "✘ Faltante"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] text-primary mb-1 block">Video principal (URL)</label>
                  <Input value={primaryUrl} onChange={(e) => setPrimaryUrl(e.target.value)}
                    placeholder="https://..." className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
                </div>

                <div>
                  <label className="text-[10px] text-primary mb-1 block">Fallback (opcional)</label>
                  <Input value={fallbackUrl} onChange={(e) => setFallbackUrl(e.target.value)}
                    placeholder="https://..." className="h-9 bg-secondary border-primary/30 rounded-xl font-mono text-xs" />
                </div>

                <button onClick={sendVideo} disabled={sending || !primaryUrl.trim()}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Guardar EP {selectedEp}
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
