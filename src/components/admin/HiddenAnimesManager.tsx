import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, EyeOff, Eye, Trash2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getTrending, getPopular, getRecentlyUpdated } from "@/lib/anilist";
import { listHiddenAnimes, hideAnime, unhideAnime } from "@/lib/hidden-animes";
import { useAuth } from "@/contexts/AuthContext";

export default function HiddenAnimesManager() {
  const { user } = useAuth();
  const [section, setSection] = useState<"recent" | "trending" | "popular">("recent");
  const [hiddenList, setHiddenList] = useState<any[]>([]);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    listHiddenAnimes().then(setHiddenList);
  }, [reload]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-hide-section", section],
    queryFn: async () => {
      // 'recent' = animes que aparecen en Bento + Últimos Episodios (los que ven los usuarios)
      if (section === "recent") return (await getRecentlyUpdated(1, 30)).media;
      if (section === "trending") return (await getTrending(1, 30)).media;
      return (await getPopular(1, 30)).media;
    },
    staleTime: 5 * 60 * 1000,
  });

  const hiddenIds = new Set(hiddenList.map((h) => h.anilist_id));

  const toggle = async (anime: any) => {
    const isHidden = hiddenIds.has(anime.id);
    if (isHidden) {
      await unhideAnime(anime.id);
      toast.success("Anime restaurado en el home");
    } else {
      await hideAnime(anime.id, anime.title?.english || anime.title?.romaji || "Sin título", user?.id);
      toast.success("Anime ocultado del home");
    }
    setReload((n) => n + 1);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2 flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-primary" /> Ocultar animes del Home
        </h3>
        <p className="text-[10px] text-muted-foreground mb-3">
          Toca el ojo para ocultar/mostrar. Los ocultos se eliminan automáticamente de los carruseles.
        </p>

        <div className="flex gap-2 mb-3 flex-wrap">
          {[
            { key: "recent", label: "🕐 Recientes / Bento" },
            { key: "trending", label: "🔥 Tendencia" },
            { key: "popular", label: "⭐ Populares" },
          ].map((s) => (
            <button
              key={s.key}
              onClick={() => setSection(s.key as any)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
                section === s.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {data?.map((anime: any) => {
              const hidden = hiddenIds.has(anime.id);
              return (
                <div key={anime.id} className={`relative rounded-xl overflow-hidden border-2 ${hidden ? "border-destructive opacity-50" : "border-border"}`}>
                  <img src={anime.coverImage?.large} alt="" className="w-full aspect-[3/4] object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
                  <p className="absolute bottom-1 left-1.5 right-1.5 text-[9px] font-bold text-white line-clamp-2">
                    {anime.title?.english || anime.title?.romaji}
                  </p>
                  <button
                    onClick={() => toggle(anime)}
                    className={`absolute top-1 right-1 w-7 h-7 rounded-full flex items-center justify-center backdrop-blur-sm transition ${
                      hidden ? "bg-destructive text-white" : "bg-black/60 text-primary hover:bg-primary hover:text-primary-foreground"
                    }`}
                  >
                    {hidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Lista de ocultos */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-2">Animes ocultos ({hiddenList.length})</h3>
        {hiddenList.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">Ninguno oculto aún</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {hiddenList.map((h) => (
              <div key={h.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary border border-border">
                <span className="flex-1 text-xs text-foreground truncate">{h.anime_title || `ID ${h.anilist_id}`}</span>
                <button onClick={() => toggle({ id: h.anilist_id })} className="p-1.5 rounded bg-primary/20 text-primary hover:bg-primary/30">
                  <Eye className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
