import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all active:scale-95 ${
        liked
          ? "bg-primary/20 border-primary text-primary shadow-[0_0_10px_hsl(var(--primary)/0.4)]"
          : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/60 hover:text-primary"
      } ${className}`}
    >
      <Heart className={`w-3.5 h-3.5 ${liked ? "fill-current" : ""}`} />
      <span className="text-xs font-bold">{compactCount(count)}</span>
    </button>
  );
}
