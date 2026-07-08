import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import LazyImage from "@/components/LazyImage";
import { Sparkles, Heart } from "lucide-react";
import type { AniListCharacter } from "@/lib/anilist-characters";
import { translateText } from "@/lib/translate";


interface Props {
  character: AniListCharacter;
  index?: number;
}

/**
 * CharacterCard — retrato editorial de personaje.
 * Mismo lenguaje visual que StoryCard: tipografía serif + ganchos narrativos,
 * pero con la foto del personaje como pieza central.
 */
export default function CharacterCard({ character: c, index = 0 }: Props) {
  const bio = c.description;
  const firstStop = bio.search(/[.!?]\s/);
  const rawHook = firstStop > 60 ? bio.slice(0, firstStop + 1) : bio.slice(0, 260);
  const [hook, setHook] = useState(rawHook);

  useEffect(() => {
    if (!rawHook) return;
    let alive = true;
    translateText(rawHook, `char_hook_${c.id}`).then((t) => { if (alive && t) setHook(t); });
    return () => { alive = false; };
  }, [rawHook, c.id]);

  // "Poderes / rasgos" — busca líneas clave
  const powerHints: string[] = [];
  const lower = bio.toLowerCase();
  const map: [RegExp, string][] = [
    [/quirk|stand|semblance|nen|chakra|magic|magi[ck]/i, "Poder singular"],
    [/sword|blade|katana|espada/i, "Maestro de la espada"],
    [/demon|devil|akuma/i, "Sangre demoníaca"],
    [/hero|h[eé]roe/i, "Vocación de héroe"],
    [/king|prince|princess|royal/i, "Linaje real"],
    [/pirate|pirata/i, "Espíritu pirata"],
    [/ninja|shinobi/i, "Camino del ninja"],
    [/genius|prodig/i, "Mente prodigiosa"],
  ];
  for (const [re, label] of map) {
    if (re.test(lower) && !powerHints.includes(label)) powerHints.push(label);
    if (powerHints.length >= 2) break;
  }
  if (powerHints.length === 0) powerHints.push("Ícono de culto");

  const labels = ["Ficha", "Personaje", "Retrato", "Leyenda", "Perfil"];
  const label = labels[index % labels.length];

  const to = c.animeId ? `/anime/${c.animeId}` : "#";

  return (
    <Link
      to={to}
      className="story-card group block break-inside-avoid mb-3 md:mb-4 relative overflow-hidden rounded-2xl border border-primary/15 hover:border-primary/60 transition-colors bg-gradient-to-b from-secondary/60 to-background"
      style={{ animationDelay: `${(index % 5) * 60}ms` }}
    >
      {/* Retrato */}
      <div className="relative overflow-hidden">
        <LazyImage
          src={c.image}
          alt={c.name}
          className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
          style={{ aspectRatio: "3 / 4" }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
        <div className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[9px] tracking-[0.35em] uppercase text-white/85">{label}</span>
        </div>
        {c.favourites > 0 && (
          <div className="absolute top-3 right-3 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur px-2.5 py-1">
            <Heart className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[10px] font-mono text-white/85">
              {c.favourites > 999 ? `${(c.favourites / 1000).toFixed(1)}k` : c.favourites}
            </span>
          </div>
        )}
      </div>

      {/* Cuerpo editorial */}
      <div className="relative -mt-6 p-5 md:p-6">
        <h3 className="directory-hero-title text-lg md:text-2xl font-bold text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {c.name}
        </h3>
        {c.animeTitle && (
          <p className="mt-1 text-[10px] uppercase tracking-widest text-primary/80">
            de · {c.animeTitle}
          </p>
        )}

        {hook && (
          <p className="mt-3 text-[12px] md:text-sm text-muted-foreground leading-relaxed line-clamp-5 font-serif-body italic">
            "{hook}"
          </p>
        )}

        <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1.5">
            {powerHints.map((p) => (
              <span
                key={p}
                className="text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-primary/30 text-primary/90"
              >
                {p}
              </span>
            ))}
          </div>
          <span className="text-[10px] text-primary/80 group-hover:text-primary transition-colors">
            Ver anime →
          </span>
        </div>
      </div>
    </Link>
  );
}
