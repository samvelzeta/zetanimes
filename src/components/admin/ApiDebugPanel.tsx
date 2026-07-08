import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bug, Check, Loader2, Search, Send, X, Database, Subtitles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAnime, getTitle, type AniListMedia } from "@/lib/anilist";
import { getSeekeEpisode, titleToSlug } from "@/lib/zetapi";
import { getSlugOverride } from "@/lib/slug-overrides";
import { supabase } from "@/integrations/supabase/client";
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
  const [seekeUrl, setSeekeUrl] = useState("");
  const [dbUrls, setDbUrls] = useState<{ sub: string[]; latino: string[] }>({ sub: [], latino: [] });
  const [loadingDbUrls, setLoadingDbUrls] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // Cargar enlaces madre Seeke guardados en video_cache para el anime seleccionado
  // (episode=0). Cada idioma se guarda en una fila separada.
  const loadSeekeUrlsFromDb = async (anilistId: number, currentLang: "sub" | "latino") => {
    setLoadingDbUrls(true);
    try {
      const { data, error } = await supabase
        .from("video_cache")
        .select("lang, sources")
        .eq("anilist_id", anilistId)
        .eq("episode", 0);
      if (error) throw error;
      const out: { sub: string[]; latino: string[] } = { sub: [], latino: [] };
      for (const row of (data || []) as any[]) {
        const seeke = row?.sources?.seeke;
        const arr = Array.isArray(seeke) ? seeke.filter((u: any) => typeof u === "string" && u.trim()) : [];
        const key = row.lang === "latino" ? "latino" : "sub";
        out[key].push(...arr);
      }
      setDbUrls(out);
      const first = out[currentLang][0] || out[currentLang === "sub" ? "latino" : "sub"][0] || "";
      setSeekeUrl(first);
      if (!first) {
        toast.info("No hay enlace madre Seeke guardado en la BD para este anime");
      }
    } catch (e: any) {
      toast.error(`No se pudo leer video_cache: ${e?.message || e}`);
    } finally {
      setLoadingDbUrls(false);
    }
  };

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
    setSeekeJson(null);
    setRequestUrl("");
    setSeekeUrl("");
    setDbUrls({ sub: [], latino: [] });
    setQuery("");
    setResults([]);
    // Auto-cargar enlace madre Seeke desde video_cache
    await loadSeekeUrlsFromDb(anime.id, lang);
  };

  // Cuando cambia idioma, si hay URL guardada para ese idioma, actualízala en el input
  useEffect(() => {
    if (!selected) return;
    const urls = dbUrls[lang];
    if (urls && urls.length > 0) setSeekeUrl(urls[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

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
    const baseUrl = seekeUrl.trim();
    setSeekeLoading(true);
    setSeekeJson(null);
    try {
      const data = await getSeekeEpisode(baseUrl, episode);
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
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-bold text-foreground">Prueba Seeke / Flixlat</p>
                  <p className="text-[10px] text-muted-foreground">
                    Enlace madre precargado desde la BD (video_cache · ep 0) para <b>{lang}</b>.
                  </p>
                </div>
                <button
                  onClick={() => selected && loadSeekeUrlsFromDb(selected.id, lang)}
                  disabled={loadingDbUrls}
                  className="h-7 px-2 rounded-lg bg-secondary text-foreground text-[10px] font-bold flex items-center gap-1 hover:bg-muted disabled:opacity-50"
                  title="Recargar enlace desde video_cache"
                >
                  {loadingDbUrls ? <Loader2 className="w-3 h-3 animate-spin" /> : <Database className="w-3 h-3" />}
                  BD
                </button>
              </div>
              <div className="flex flex-wrap gap-1 text-[10px]">
                <span className={`px-1.5 py-0.5 rounded-full font-bold ${dbUrls.sub.length ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  🇯🇵 sub: {dbUrls.sub.length}
                </span>
                <span className={`px-1.5 py-0.5 rounded-full font-bold ${dbUrls.latino.length ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                  🌎 latino: {dbUrls.latino.length}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Input
                  value={seekeUrl}
                  onChange={(e) => setSeekeUrl(e.target.value)}
                  placeholder="Pega o edita la URL base Seeke…"
                  className="min-w-[260px] flex-1 h-9 bg-background border-primary/30 rounded-xl font-mono text-xs"
                />
                <button onClick={requestSeeke} disabled={seekeLoading || !seekeUrl.trim()} className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50">
                  {seekeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Probar Seeke EP {episode}
                </button>
              </div>
              {seekeJson && (
                <>
                  {(() => {
                    const subs = seekeJson?.response?.subtitles;
                    const count = Array.isArray(subs) ? subs.length : 0;
                    const hasEs = Array.isArray(subs) && subs.some((s: any) => (s?.lang || "").toLowerCase().startsWith("es"));
                    return (
                      <div className="flex flex-wrap gap-1.5 text-[10px] font-bold">
                        <span className={`px-2 py-0.5 rounded-full flex items-center gap-1 ${count > 0 ? "bg-green-500/15 text-green-500" : "bg-destructive/15 text-destructive"}`}>
                          <Subtitles className="w-3 h-3" /> subs: {count}
                        </span>
                        {count > 0 && (
                          <span className={`px-2 py-0.5 rounded-full ${hasEs ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                            {hasEs ? "incluye ES" : "sin ES"}
                          </span>
                        )}
                        {seekeJson?.response?.cached && (
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">cache</span>
                        )}
                      </div>
                    );
                  })()}
                  <pre className="max-h-60 overflow-auto rounded-lg border border-border bg-background/60 p-3 text-[10px] text-foreground whitespace-pre-wrap break-words font-mono">
                    {JSON.stringify(seekeJson, null, 2)}
                  </pre>
                </>
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