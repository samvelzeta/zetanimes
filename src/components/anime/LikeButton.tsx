import { useEffect, useState } from "react";
import { Heart, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getLikeCount, hasUserLiked, toggleLike, compactCount } from "@/lib/anime-likes";
import { toast } from "sonner";

interface Props {
  anilistId: number;
  className?: string;
}

export default function LikeButton({ anilistId, className = "" }: Props) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!anilistId) return;
    let cancel = false;
    (async () => {
      const [c, l] = await Promise.all([
        getLikeCount(anilistId),
        user?.id ? hasUserLiked(user.id, anilistId) : Promise.resolve(false),
      ]);
      if (cancel) return;
      setCount(c);
      setLiked(l);
    })();
    return () => { cancel = true; };
  }, [anilistId, user?.id]);

  const onClick = async () => {
    if (!user) { toast.error("Inicia sesión para dar like"); return; }
    if (busy) return;
    setBusy(true);
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    if (next) setBurst((b) => b + 1);
    try {
      await toggleLike(user.id, anilistId, liked);
    } catch {
      setLiked(liked);
      setCount((c) => c + (next ? -1 : 1));
      toast.error("No se pudo actualizar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={busy}
      aria-pressed={liked}
      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all active:scale-95 overflow-visible ${
        liked
          ? "bg-primary/25 border-primary/80 text-primary shadow-[0_0_18px_hsl(var(--primary)/0.55)]"
          : "bg-white/10 border-white/25 text-white hover:bg-white/15 hover:border-primary/60 hover:text-primary"
      } ${className}`}
    >
      <span className="relative inline-flex items-center justify-center w-4 h-4">
        <Heart
          key={burst}
          className={`w-3.5 h-3.5 transition-transform ${liked ? "fill-current heart-pop" : ""}`}
        />
        {liked && burst > 0 && (
          <>
            <span key={`glow-${burst}`} className="pointer-events-none absolute inset-0 rounded-full heart-glow" />
            <Sparkles key={`spk-${burst}`} className="pointer-events-none absolute -top-2 -right-2 w-3 h-3 text-primary heart-spark" />
          </>
        )}
      </span>
      <span className="text-xs font-bold tabular-nums">{compactCount(count)}</span>
    </button>
  );
}
