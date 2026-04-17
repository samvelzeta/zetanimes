import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, Loader2, Trash2, Save, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { listSlugOverrides, saveSlugOverride, deleteSlugOverride } from "@/lib/slug-overrides";
import { useAuth } from "@/contexts/AuthContext";

interface AnilistResult {
  id: number;
  title: { romaji: string; english: string | null };
  coverImage: { large: string };
}

export default function SlugManager() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AnilistResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [overrides, setOverrides] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id: number; title: string; cover: string; slug: string; notes: string } | null>(null);

  useEffect(() => {
    refresh();
  }, []);

  const refresh = async () => {
    setLoading(true);
    const list = await listSlugOverrides();
    setOverrides(list);
    setLoading(false);
  };

  // Buscar en AniList
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query($s:String){Page(perPage:8){media(search:$s,type:ANIME,isAdult:false){id title{romaji english} coverImage{large}}}}`,
            variables: { s: q },
          }),
        });
        const json = await res.json();
        setResults(json.data?.Page?.media || []);
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const isOverridden = (id: number) => overrides.find((o) => o.anilist_id === id);

  const startEdit = (anime: AnilistResult) => {
    const existing = isOverridden(anime.id);
    setEditing({
      id: anime.id,
      title: anime.title.english || anime.title.romaji,
      cover: anime.coverImage.large,
      slug: existing?.manual_slug || "",
      notes: existing?.notes || "",
    });
  };

  const startEditExisting = (o: any) => {
    setEditing({
      id: o.anilist_id,
      title: o.anime_title || "",
      cover: o.cover_image || "",
      slug: o.manual_slug,
      notes: o.notes || "",
    });
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.slug.trim()) return toast.error("El slug es obligatorio");
    const ok = await saveSlugOverride({
      anilist_id: editing.id,
      manual_slug: editing.slug.trim().toLowerCase(),
      anime_title: editing.title,
      cover_image: editing.cover,
      notes: editing.notes,
      created_by: user?.id,
    });
    if (ok) {
      toast.success("Slug guardado");
      setEditing(null);
      refresh();
    } else toast.error("Error al guardar");
  };

  const remove = async (id: number) => {
    if (!confirm("¿Eliminar este override?")) return;
    const ok = await deleteSlugOverride(id);
    if (ok) {
      toast.success("Eliminado");
      refresh();
    }
  };

  return (
    <div className="space-y-5">
      {/* Buscador */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
          <Search className="w-4 h-4 text-primary" /> Buscar anime
        </h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Hunter x Hunter, JoJo..."
            className="pl-10 h-10 bg-secondary border-primary/30 rounded-xl"
          />
          {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
        </div>

        {results.length > 0 && (
          <div className="mt-3 space-y-2 max-h-72 overflow-y-auto">
            {results.map((r) => {
              const ov = isOverridden(r.id);
              return (
                <button
                  key={r.id}
                  onClick={() => startEdit(r)}
                  className="w-full flex items-center gap-3 p-2 rounded-xl bg-secondary hover:bg-muted transition border border-border text-left"
                >
                  <img src={r.coverImage.large} alt="" className="w-10 h-14 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{r.title.english || r.title.romaji}</p>
                    <p className="text-[10px] text-muted-foreground truncate">ID: {r.id}</p>
                  </div>
                  {ov ? (
                    <span className="px-2 py-0.5 rounded bg-green-600/20 text-green-400 text-[10px] font-bold">
                      slug: {ov.manual_slug}
                    </span>
                  ) : (
                    <Plus className="w-4 h-4 text-primary" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de overrides existentes */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Slugs manuales guardados ({overrides.length})</h3>
        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : overrides.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">Sin overrides aún</p>
        ) : (
          <div className="space-y-2">
            {overrides.map((o) => (
              <div key={o.id} className="flex items-center gap-3 p-2 rounded-xl bg-secondary border border-border">
                {o.cover_image && <img src={o.cover_image} alt="" className="w-10 h-14 object-cover rounded" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{o.anime_title || `ID ${o.anilist_id}`}</p>
                  <p className="text-[10px] text-primary font-mono truncate">{o.manual_slug}</p>
                  {o.notes && <p className="text-[9px] text-muted-foreground truncate">{o.notes}</p>}
                </div>
                <button onClick={() => startEditExisting(o)} className="p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary/30">
                  <Save className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => remove(o.anilist_id)} className="p-1.5 rounded-lg bg-destructive/20 text-destructive hover:bg-destructive/30">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditing(null)}>
          <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-black text-foreground">Editar slug manual</h2>
                <button onClick={() => setEditing(null)}><X className="w-5 h-5" /></button>
              </div>
              <div className="flex items-center gap-3 bg-secondary rounded-xl p-3">
                {editing.cover && <img src={editing.cover} alt="" className="w-12 h-16 object-cover rounded" />}
                <div>
                  <p className="text-sm font-bold text-foreground">{editing.title}</p>
                  <p className="text-[10px] text-muted-foreground">ID: {editing.id}</p>
                </div>
              </div>
              <div>
                <label className="text-[10px] text-primary font-bold mb-1 block">Slug del scraper</label>
                <Input
                  value={editing.slug}
                  onChange={(e) => setEditing({ ...editing, slug: e.target.value })}
                  placeholder="hunter-x-hunter-2011"
                  className="h-10 bg-secondary border-primary/30 rounded-xl font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Tal como aparece en la URL del scraper (ej. <code>hunter-x-hunter-2011</code>)
                </p>
              </div>
              <div>
                <label className="text-[10px] text-primary font-bold mb-1 block">Notas (opcional)</label>
                <textarea
                  value={editing.notes}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  className="w-full h-16 bg-secondary border border-primary/30 rounded-xl p-3 text-xs text-foreground resize-none"
                  placeholder="Por qué se necesita este override…"
                />
              </div>
              <button onClick={save} className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> Guardar override
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
