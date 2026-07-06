import { useMemo, useState } from "react";
import { Play, Eye, EyeOff, Lock, ChevronDown } from "lucide-react";

const MAX_TITLE_CHARS = 20;

function ExpandableTitle({ text, className }: { text: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const needs = text.length > MAX_TITLE_CHARS;
  if (!needs) return <span className={className}>{text}</span>;
  return (
    <span className={`inline-flex items-start gap-1 ${className || ""}`}>
      <span className="min-w-0 break-words">
        {open ? text : `${text.slice(0, MAX_TITLE_CHARS)}...`}
      </span>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="flex-shrink-0 text-primary hover:text-primary/80"
        aria-label={open ? "Contraer" : "Ver título completo"}
      >
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
    </span>
  );
}


interface StreamingEp {
  title?: string;
  thumbnail?: string;
}

interface Props {
  total: number;
  cover: string;
  animeTitle: string;
  streamingEpisodes?: StreamingEp[];
  selected?: number;
  watched?: Set<string>;
  slug?: string;
  maxAvailable?: number;
  onSelect?: (ep: number) => void;
  onToggleWatched?: (ep: number) => void;
  linkTo?: (ep: number) => string;
  pageSize?: number;
}

/**
 * Listado de capítulos estilo horizontal:
 * imagen a la izquierda + info a la derecha (sin ícono de descarga).
 * Usa el thumbnail de AniList `streamingEpisodes.thumbnail` si existe,
 * si no, el cover del anime recortado a 16:9.
 */
export default function EpisodeList({
  total, cover, animeTitle, streamingEpisodes,
  selected, watched, slug, maxAvailable,
  onSelect, onToggleWatched, linkTo, pageSize = 24,
}: Props) {
  const numbers = useMemo(
    () => Array.from({ length: Math.max(total, 0) }, (_, i) => i + 1),
    [total]
  );
  const [visible, setVisible] = useState(pageSize);
  const shown = numbers.slice(0, visible);

  if (numbers.length === 0) {
    return <p className="text-xs text-muted-foreground text-center py-8">Sin episodios disponibles</p>;
  }

  return (
    <div className="space-y-2">
      <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
        {shown.map((n) => {
          const s = streamingEpisodes?.[n - 1];
          const thumb = s?.thumbnail || cover;
          const epTitle = s?.title?.replace(/^Episode\s*\d+\s*[-–]?\s*/i, "") || `Capítulo ${n}`;
          const epSlug = slug ? `${slug}-${n}` : "";
          const isWatched = epSlug ? !!watched?.has(epSlug) : false;
          const isActive = selected === n;
          const blocked = !!maxAvailable && n > maxAvailable;

          const inner = (
            <>
              <div className="relative w-32 sm:w-36 aspect-video flex-shrink-0 overflow-hidden bg-black">
                <img
                  src={thumb}
                  alt={`EP ${n}`}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />
                <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-black text-white">
                  EP {n}
                </span>
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-primary/40">
                    <Play className="w-5 h-5 text-white fill-current" />
                  </div>
                )}
                {blocked && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                    <Lock className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 p-2.5 flex flex-col justify-center">
                <p className={`text-xs font-black uppercase tracking-wide ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                  Capítulo {n}
                </p>
                <p className="text-sm font-bold text-foreground line-clamp-2 leading-tight mt-0.5">
                  {epTitle}
                </p>
                <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{animeTitle}</p>
              </div>
              {onToggleWatched && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (!blocked) onToggleWatched(n); }}
                  className={`self-stretch px-2 flex items-center justify-center transition ${isWatched ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  title={isWatched ? "Marcado como visto" : "Marcar como visto"}
                >
                  {isWatched ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              )}
            </>
          );

          const commonCls = `flex items-stretch rounded-xl overflow-hidden border transition-all ${
            isActive ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/40 hover:bg-secondary"
          } ${blocked ? "opacity-50 cursor-not-allowed" : ""}`;

          if (linkTo && !onSelect) {
            return (
              <a key={n} href={blocked ? undefined : linkTo(n)} className={commonCls}>
                {inner}
              </a>
            );
          }
          return (
            <button
              key={n}
              disabled={blocked}
              onClick={() => { if (!blocked) onSelect?.(n); }}
              className={`text-left w-full ${commonCls}`}
            >
              {inner}
            </button>
          );
        })}
      </div>
      {visible < numbers.length && (
        <button
          onClick={() => setVisible((v) => v + pageSize)}
          className="w-full py-2 rounded-xl bg-secondary text-xs font-bold text-foreground hover:bg-muted transition"
        >
          Ver más ({numbers.length - visible} restantes)
        </button>
      )}
    </div>
  );
}
