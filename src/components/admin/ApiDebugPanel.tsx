import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bug, Check, Loader2, Search, Send, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAnime, getTitle, type AniListMedia } from "@/lib/anilist";
import { getSeekeEpisode, titleToSlug } from "@/lib/zetapi";
import { getSlugOverride } from "@/lib/slug-overrides";
import { toast } from "sonner";

const ZET_BASE = "https://zetapi-api.samvelzeta.workers.dev/api";

interface DebugAnime {
  id: number;
  title: string;
  slug: string;
  cover: string;
  totalEpisodes: number;
}

export default function ApiDebugPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<DebugAnime | null>(null);
  const [episode, setEpisode] = useState(1);
  const [lang, setLang] = useState<"sub" | "latino">("sub");
  const [loading, setLoading] = useState(false);
  const [seekeLoading, setSeekeLoading] = useState(false);
  const [rawJson, setRawJson] = useState<any>(null);
  const [seekeJson, setSeekeJson] = useState<any>(null);
  const [requestUrl, setRequestUrl] = useState("");
  const [seekeUrl, setSeekeUrl] = useState("https://flixlat.com/es/detail/drama/Q7KLWpsDuwCBm24xji2Bf-Erased");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await searchAnime(query, 1, 10);
        setResults(res.media || []);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query]);

  const selectAnime = async (anime: AniListMedia) => {
    const override = await getSlugOverride(anime.id);
    const slug = override || titleToSlug(anime.title?.romaji || anime.title?.english || getTitle(anime));
    setSelected({
      id: anime.id,
      title: getTitle(anime),
      slug,
      cover: anime.coverImage?.large || anime.coverImage?.extraLarge || "",
      totalEpisodes: anime.episodes || anime.nextAiringEpisode?.episode || 24,
    });
    setEpisode(1);
    setRawJson(null);
    setRequestUrl("");
    setQuery("");
    setResults([]);
  };

  const requestEpisode = async (ep = episode, selectedLang = lang) => {
    if (!selected) return;
    const url = `${ZET_BASE}/anime/${encodeURIComponent(selected.slug)}/episode/${ep}?lang=${selectedLang}`;
    setRequestUrl(url);
    setLoading(true);
    setRawJson(null);
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      const text = await res.text();
      let parsed: any;
      try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; }
      setRawJson({ status: res.status, ok: res.ok, url, response: parsed });
      if (!res.ok) toast.error(`API respondió ${res.status}`);
    } catch (error: any) {
      setRawJson({ ok: false, url, error: String(error?.message || error) });
      toast.error("No se pudo consultar la API");
    }
    setLoading(false);
  };

  const requestSeeke = async () => {
    if (!seekeUrl.trim()) return toast.error("Pega la URL base de Seeke/Flixlat");
    const baseUrl = seekeUrl.trim().replace(/\/\d+\/?(?:[?#].*)?$/, "");
    setSeekeLoading(true);
    setSeekeJson(null);
    try {
      const data = await getSeekeEpisode(baseUrl, episode);
      setSeekeUrl(baseUrl);
      setSeekeJson({ ok: true, request: { url: baseUrl, ep: episode }, response: data });
      toast.success("Seeke respondió correctamente");
    } catch (error: any) {
      setSeekeJson({ ok: false, request: { url: baseUrl, ep: episode }, error: String(error?.message || error) });
      toast.error("Seeke no devolvió video");
    }
    setSeekeLoading(false);
  };

  const episodes = Array.from({ length: Math.max(1, selected?.totalEpisodes || 0) }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Bug className="w-4 h-4 text-primary" /> Debug JSON de API
        </h3>
        <p className="text-[10px] text-muted-foreground mt-1">
          Busca anime, elige episodio e idioma; solo consulta y muestra el JSON, no reproduce video.
        </p>
      </div>

      {selected ? (
        <div className="flex items-center gap-3 bg-secondary rounded-xl p-3 border border-primary/30">
          {selected.cover && <img src={selected.cover} alt="" className="w-10 h-14 rounded object-cover" />}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{selected.title}</p>
            <Input
              value={selected.slug}
              onChange={(e) => setSelected({ ...selected, slug: e.target.value.trim().toLowerCase() })}
              className="mt-1 h-8 bg-background border-primary/30 rounded-lg font-mono text-[10px]"
            />
          </div>
          <button onClick={() => { setSelected(null); setRawJson(null); }} className="text-muted-foreground hover:text-destructive">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar anime para probar API..." className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl" />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
          {results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1 bg-background border border-border rounded-xl shadow-xl z-50 max-h-64 overflow-y-auto">
              {results.map((anime) => (
                <button key={anime.id} onClick={() => selectAnime(anime)} className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition text-left border-b border-border last:border-0">
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

      {selected && (
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div className="rounded-xl border border-border bg-secondary/40 max-h-[460px] overflow-y-auto p-2">
            {episodes.map((ep) => (
              <button key={ep} onClick={() => setEpisode(ep)} className={`w-full h-9 px-3 rounded-lg text-xs font-bold flex items-center justify-between ${episode === ep ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"}`}>
                Cap {ep}
                {episode === ep && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>

          <div className="space-y-3 min-w-0">
            <div className="rounded-xl border border-primary/30 bg-secondary/40 p-3 space-y-3">
              <div>
                <p className="text-xs font-bold text-foreground">Prueba Seeke / Flixlat</p>
                <p className="text-[10px] text-muted-foreground">Envía siempre URL base + capítulo. No construye m3u8 ni usa slug.</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={seekeUrl}
                  onChange={(e) => setSeekeUrl(e.target.value)}
                  placeholder="https://flixlat.com/es/detail/..."
                  className="min-w-[260px] flex-1 h-9 bg-background border-primary/30 rounded-xl font-mono text-xs"
                />
                <button onClick={requestSeeke} disabled={seekeLoading} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  {seekeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Probar Seeke EP {episode}
                </button>
              </div>
              {seekeJson && (
                <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-background/60 p-3 text-[10px] text-foreground whitespace-pre-wrap break-words font-mono">
                  {JSON.stringify(seekeJson, null, 2)}
                </pre>
              )}
            </div>

            <div className="flex gap-2 flex-wrap">
              {(["sub", "latino"] as const).map((l) => (
                <button key={l} onClick={() => setLang(l)} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${lang === l ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                  {l === "sub" ? "🇯🇵 Japonés/Sub" : "🌎 Latino"}
                </button>
              ))}
              <button onClick={() => requestEpisode()} disabled={loading} className="ml-auto px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Pedir JSON EP {episode}
              </button>
            </div>

            {requestUrl && <p className="text-[10px] text-muted-foreground font-mono break-all">{requestUrl}</p>}

            <div className="rounded-xl border border-border bg-background/60 min-h-[300px] max-h-[560px] overflow-auto p-3">
              {loading ? (
                <div className="h-72 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
              ) : rawJson ? (
                <pre className="text-[10px] text-foreground whitespace-pre-wrap break-words font-mono">{JSON.stringify(rawJson, null, 2)}</pre>
              ) : (
                <div className="h-72 flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <AlertCircle className="w-6 h-6" />
                  <p className="text-xs">Selecciona un capítulo y pulsa “Pedir JSON”.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}