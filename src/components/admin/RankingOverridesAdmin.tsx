import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { searchAnime, type AniListMedia, getTitle } from "@/lib/anilist";
import { Input } from "@/components/ui/input";
import { Loader2, Search, Plus, Trash2, ListOrdered, Power } from "lucide-react";
import { toast } from "sonner";
import LazyImage from "@/components/LazyImage";

interface Override {
  id: string;
  position: number;
  anilist_id: number;
  anime_title: string | null;
  cover_image: string | null;
  enabled: boolean;
}

export default function RankingOverridesAdmin() {
  const [items, setItems] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState(1);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [searching, setSearching] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("ranking_overrides")
      .select("id, position, anilist_id, anime_title, cover_image, enabled")
      .order("position", { ascending: true });
    setItems((data as Override[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await searchAnime(query, 1, 8);
        setResults(data?.media || []);
      } finally { setSearching(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  const addOverride = async (anime: AniListMedia) => {
    if (position < 1 || position > 10) {
      toast.error("Posición debe ser 1-10");
      return;
    }
    const cover = anime.coverImage?.large || anime.coverImage?.extraLarge || null;
    // Reemplazar si ya existe esa posición
    await supabase.from("ranking_overrides").delete().eq("position", position);
    const { error } = await supabase.from("ranking_overrides").insert({
      position,
      anilist_id: anime.id,
      anime_title: getTitle(anime),
      cover_image: cover,
      enabled: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`#${position}: ${getTitle(anime)}`);
    setQuery("");
    setResults([]);
    load();
  };

  const toggle = async (it: Override) => {
    await supabase.from("ranking_overrides").update({ enabled: !it.enabled }).eq("id", it.id);
    load();
  };

  const remove = async (it: Override) => {
    await supabase.from("ranking_overrides").delete().eq("id", it.id);
    toast.success("Eliminado");
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-1">
          <ListOrdered className="w-4 h-4 text-primary" /> Top Ranking manual
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Fija manualmente los puestos del Top Rating. Si está activo, reemplaza al anime que AniList traería en esa posición.
        </p>
      </div>

      <div className="rounded-xl border border-primary/20 bg-secondary/40 p-3 space-y-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-primary font-bold">Posición</label>
          <select
            value={position}
            onChange={(e) => setPosition(Number(e.target.value))}
            className="bg-secondary border border-primary/30 rounded-lg px-2 py-1 text-sm"
          >
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>#{n}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar anime…"
            className="pl-9 bg-secondary border-primary/30 rounded-lg"
          />
        </div>
        {searching && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
        {results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto custom-scroll pr-1">
            {results.map((a) => (
              <button
                key={a.id}
                onClick={() => addOverride(a)}
                className="text-left rounded-lg overflow-hidden bg-background border border-border hover:border-primary/60 transition"
              >
                <div className="aspect-[3/4] bg-secondary">
                  {a.coverImage?.large && (
                    <LazyImage src={a.coverImage.large} alt={getTitle(a)} className="w-full h-full" />
                  )}
                </div>
                <div className="p-2 flex items-start gap-1">
                  <Plus className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] font-bold line-clamp-2">{getTitle(a)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h4 className="text-xs font-bold text-foreground mb-2">Overrides activos</h4>
        {loading ? (
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin overrides. El ranking se genera automáticamente desde AniList.</p>
        ) : (
          <div className="space-y-2">
            {items.map((it) => (
              <div key={it.id} className={`flex items-center gap-3 p-2 rounded-lg border ${it.enabled ? "border-primary/30 bg-secondary/60" : "border-border bg-secondary/20 opacity-60"}`}>
                <div className="w-10 text-center text-xl font-black text-primary">#{it.position}</div>
                <div className="w-12 h-16 rounded overflow-hidden bg-background flex-shrink-0">
                  {it.cover_image && <LazyImage src={it.cover_image} alt={it.anime_title || ""} className="w-full h-full" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">{it.anime_title || `AniList ${it.anilist_id}`}</p>
                  <p className="text-[10px] text-muted-foreground">ID: {it.anilist_id}</p>
                </div>
                <button onClick={() => toggle(it)} className="p-2 rounded-lg bg-background hover:bg-muted" title={it.enabled ? "Desactivar" : "Activar"}>
                  <Power className={`w-4 h-4 ${it.enabled ? "text-green-400" : "text-muted-foreground"}`} />
                </button>
                <button onClick={() => remove(it)} className="p-2 rounded-lg bg-background hover:bg-destructive/20 text-destructive">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
