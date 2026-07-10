import { useEffect } from "react";
import { toast } from "sonner";
import { useUserXP, rankName } from "@/hooks/useUserXP";
import { Sparkles } from "lucide-react";

/**
 * Se monta en el Layout. Cuando useUserXP detecta subida de nivel,
 * lanza un toast de celebración. Es silencioso el resto del tiempo.
 */
export default function LevelUpToast() {
  const { xp, leveledUp } = useUserXP();
  useEffect(() => {
    if (!leveledUp) return;
    toast.success(
      `¡Subiste a nivel ${xp.level}! · ${rankName(xp.rank_slug)}`,
      {
        icon: <Sparkles className="w-4 h-4 text-primary" />,
        duration: 5000,
      }
    );
  }, [leveledUp, xp.level, xp.rank_slug]);
  return null;
}
