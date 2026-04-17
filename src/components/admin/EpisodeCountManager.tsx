// Admin tool: manually set the total number of episodes for an anime
// when AniList/Jikan don't report it (e.g. One Piece, ongoing long-runners).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Search, Save } from "lucide-react";

interface Override {
  id: string;
  anilist_id: number;
  anime_title: string | null;
  episode_count: number;
  notes: string | null;
  updated_at: string;
}

export default function EpisodeCountManager() {
  const [list, setList] = useState<Override[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Form
  const [anilistId, setAnilistId] = useState("");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("episode_count_overrides")
      .select("*")
      .order("updated_at", { ascending: false });
    setList((data as Override[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const fetchFromApis = async () => {
    if (!anilistId) return toast.error("Pon el AniList ID primero");
    setAutoLoading(true);
    try {
      // 1) AniList
      const aniRes = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query($id:Int){Media(id:$id,type:ANIME){title{romaji english} episodes nextAiringEpisode{episode}}}`,
          variables: { id: Number(anilistId) },
        }),
      });
      const aniJson = await aniRes.json();
      const m = aniJson?.data?.Media;
      const aniTitle = m?.title?.english || m?.title?.romaji;
      if (aniTitle) setTitle(aniTitle);

      let resolved = m?.episodes || (m?.nextAiringEpisode?.episode ? m.nextAiringEpisode.episode - 1 : 0);

      // 2) Jikan fallback
      if (!resolved && aniTitle) {
        try {
          const jr = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(aniTitle)}&limit=1`);
          const jj = await jr.json();
          resolved = jj?.data?.[0]?.episodes || 0;
        } catch {}
      }

      if (resolved > 0) {
        setCount(String(resolved));
        toast.success(`Detectado: ${resolved} episodios`);
      } else {
        toast.warning("No se pudieron detectar episodios automáticamente. Ponlo manual.");
      }
    } catch (err: any) {
      toast.error(`Error: ${err?.message || err}`);
    } finally {
      setAutoLoading(false);
    }
  };

  const save = async () => {
    if (!anilistId || !count) return toast.error("AniList ID y cantidad son obligatorios");
    setSaving(true);
    const { error } = await supabase
      .from("episode_count_overrides")
      .upsert({
        anilist_id: Number(anilistId),
        anime_title: title || null,
        episode_count: Number(count),
        notes: notes || null,
      } as any, { onConflict: "anilist_id" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Override guardado");
    setAnilistId(""); setTitle(""); setCount(""); setNotes("");
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este override?")) return;
    await supabase.from("episode_count_overrides").delete().eq("id", id);
    toast.success("Eliminado");
    load();
  };

  const filtered = list.filter((o) =>
    !search ||
    o.anime_title?.toLowerCase().includes(search.toLowerCase()) ||
    String(o.anilist_id).includes(search)
  );

  return (
    <div className="space-y-6">
      {/* Form */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <Plus className="w-4 h-4 text-primary" /> Agregar / Actualizar conteo
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex gap-2">
            <input
              value={anilistId}
              onChange={(e) => setAnilistId(e.target.value)}
              type="number"
              placeholder="AniList ID (ej: 21)"
              className="flex-1 bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border"
            />
            <button
              onClick={fetchFromApis}
              disabled={autoLoading || !anilistId}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1 disabled:opacity-50"
            >
              {autoLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Auto
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título"
            className="bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border"
          />
          <input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            type="number"
            placeholder="Cantidad de episodios (ej: 1157)"
            className="bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border"
          />
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (opcional)"
            className="bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border"
          />
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="w-full sm:w-auto px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
        </button>
        <p className="text-[10px] text-muted-foreground">
          Tip: pulsa <span className="font-bold text-primary">Auto</span> para que el sistema busque en AniList + Jikan automáticamente.
        </p>
      </div>

      {/* List */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título o ID..."
            className="flex-1 bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border"
          />
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No hay overrides aún.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map((o) => (
              <div key={o.id} className="bg-card border border-border rounded-xl p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{o.anime_title || "(sin título)"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    AniList #{o.anilist_id} · <span className="text-primary font-bold">{o.episode_count} eps</span>
                    {o.notes && ` · ${o.notes}`}
                  </p>
                </div>
                <button
                  onClick={() => remove(o.id)}
                  className="w-8 h-8 rounded-lg bg-destructive/20 hover:bg-destructive/40 text-destructive flex items-center justify-center transition"
                >
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
