import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchAnime, getPopular, getByGenre } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const GENRES = ["Acción","Aventura","Comedia","Drama","Fantasía","Horror","Misterio","Romance","Sci-Fi","Slice of Life","Sobrenatural","Sports","Thriller"];
const GENRE_MAP: Record<string, string> = {
  "Acción": "Action", "Aventura": "Adventure", "Comedia": "Comedy", "Drama": "Drama",
  "Fantasía": "Fantasy", "Horror": "Horror", "Misterio": "Mystery", "Romance": "Romance",
  "Sci-Fi": "Sci-Fi", "Slice of Life": "Slice of Life", "Sobrenatural": "Supernatural",
  "Sports": "Sports", "Thriller": "Thriller",
};

export default function Directory() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 450);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["directory", debouncedQuery, selectedGenre],
    queryFn: () => {
      if (debouncedQuery) return searchAnime(debouncedQuery, 1, 30);
      if (selectedGenre) return getByGenre(GENRE_MAP[selectedGenre] || selectedGenre, 1, 30);
      return getPopular(1, 30);
    },
    staleTime: 1000 * 60 * 5,
  });

  const animes = data?.media || [];

  return (
    <div className="min-h-screen pt-4 px-4 pb-24">
      <h1 className="text-xl font-black text-foreground mb-4 tracking-tight">Directorio</h1>
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => { setQuery(e.target.value); setSelectedGenre(null); }} placeholder="Buscar..." className="pl-10 h-10 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:ring-primary/40" />
      </div>
      <div className="flex gap-2 overflow-x-auto hide-scrollbar mb-5 pb-1">
        <button onClick={() => { setSelectedGenre(null); setQuery(""); }} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!selectedGenre && !query ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>Todos</button>
        {GENRES.map((g) => (
          <button key={g} onClick={() => { setSelectedGenre(g); setQuery(""); }} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedGenre === g ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:bg-muted"}`}>{g}</button>
        ))}
      </div>
      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {Array(18).fill(0).map((_, i) => (
            <div key={i}><div className="aspect-[3/4] bg-secondary rounded-xl animate-pulse" /><div className="h-3 w-20 bg-secondary rounded mt-2 animate-pulse" /></div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
          {animes.map((anime) => <AnimeCard key={anime.id} anime={anime} size="grid" showStatus />)}
        </div>
      )}
      {!isLoading && animes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Search className="w-10 h-10 text-muted" />
          <p className="text-muted-foreground text-sm">No encontramos resultados.</p>
        </div>
      )}
    </div>
  );
}
