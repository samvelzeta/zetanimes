import { Twitter, Facebook, Link2, Tv2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  title: string;
  studio?: string;
  format?: string;
}

export default function TechInfoBlock({ title, studio, format }: Props) {
  const url = typeof window !== "undefined" ? window.location.href : "";
  const shareText = encodeURIComponent(`Mira ${title} en ZetAnime`);

  const openShare = (target: "twitter" | "facebook") => {
    const encodedUrl = encodeURIComponent(url);
    const link =
      target === "twitter"
        ? `https://twitter.com/intent/tweet?text=${shareText}&url=${encodedUrl}`
        : `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    window.open(link, "_blank", "noopener,noreferrer,width=600,height=500");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado");
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const qualityLabel = format === "MOVIE" ? "1080p" : "HD";

  return (
    <div className="mt-4 border-t border-b border-gray-800 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      {/* IZQUIERDA */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Tv2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-bold">
            Estudio
          </span>
          <span className="text-xs text-gray-300 font-semibold">
            {studio || "Desconocido"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-primary/20 text-primary border border-primary/30">
            {qualityLabel}
          </span>
          <span className="text-[10px] text-muted-foreground">
            Calidad de emisión
          </span>
        </div>
      </div>

      {/* DERECHA */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mr-2">
          Compartir
        </span>
        <button
          onClick={() => openShare("twitter")}
          aria-label="Compartir en X/Twitter"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-transparent text-muted-foreground hover:text-[#ff5100] transition"
        >
          <Twitter className="w-4 h-4" />
        </button>
        <button
          onClick={() => openShare("facebook")}
          aria-label="Compartir en Facebook"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-transparent text-muted-foreground hover:text-[#ff5100] transition"
        >
          <Facebook className="w-4 h-4" />
        </button>
        <button
          onClick={copyLink}
          aria-label="Copiar enlace"
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-transparent text-muted-foreground hover:text-[#ff5100] transition"
        >
          <Link2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
