import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { searchAnime, getTrending } from "@/lib/anilist";
import AnimeCard from "@/components/anime/AnimeCard";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQ);
  const [debouncedQuery, setDebouncedQuery] = useState(initialQ);

  // Sync URL param changes
  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q && q !== query) {
      setQuery(q);
      setDebouncedQuery(q);
    }
  }, [searchParams]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 450);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isLoading } = useQuery({
    queryKey: ["search", debouncedQuery],
    queryFn: () => debouncedQuery ? searchAnime(debouncedQuery, 1, 30) : getTrending(1, 30),
    staleTime: 1000 * 60 * 5,
  });

  const animes = data?.media || [];

  return (
    <div className="min-h-screen pt-4 px-4 pb-24">
      <h1 className="text-xl font-black text-foreground mb-4 tracking-tight">Buscar</h1>
      <div className="relative mb-6">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar anime por título..." className="pl-10 h-11 bg-secondary border-border text-foreground placeholder:text-muted-foreground rounded-xl focus-visible:ring-primary/40" />
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
          <SearchIcon className="w-10 h-10 text-muted" />
          <p className="text-muted-foreground text-sm">No encontramos resultados.</p>
        </div>
      )}
    </div>
  );
}
