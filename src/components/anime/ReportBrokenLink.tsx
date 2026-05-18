import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  slug: string;
  episodeNumber: number;
  animeTitle: string;
  animeCover: string;
  anilistId: number;
}

export default function ReportBrokenLink({ slug, episodeNumber, animeTitle, animeCover, anilistId }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [reason, setReason] = useState("");

  const report = async (type: "episode" | "full") => {
    if (!user) return toast.error("Inicia sesión para reportar");
    if (reason.trim().length < 500) return toast.error(`Describe el problema con al menos 500 caracteres (llevas ${reason.trim().length})`);
    setSending(true);
    try {
      const epNum = type === "full" ? null : episodeNumber;
      // Try to upsert - increment count if exists
      const { data: existing } = await supabase
        .from("broken_link_reports")
        .select("id, report_count")
        .eq("slug", slug)
        .eq("report_type", type)
        .is("episode_number", epNum === null ? null : undefined as any)
        .maybeSingle();

      if (existing && epNum === null) {
        // Update count for full anime
        await supabase.from("broken_link_reports")
          .update({ report_count: existing.report_count + 1, last_reported_at: new Date().toISOString() })
          .eq("id", existing.id);
      } else if (type === "episode") {
        // Check for existing episode report
        const { data: epExisting } = await supabase
          .from("broken_link_reports")
          .select("id, report_count")
          .eq("slug", slug)
          .eq("episode_number", epNum!)
          .eq("report_type", "episode")
          .maybeSingle();

        if (epExisting) {
          await supabase.from("broken_link_reports")
            .update({ report_count: epExisting.report_count + 1, last_reported_at: new Date().toISOString() })
            .eq("id", epExisting.id);
        } else {
          await supabase.from("broken_link_reports").insert({
            slug, episode_number: epNum, report_type: type,
            anime_title: animeTitle, anime_cover: animeCover, anilist_id: anilistId,
          });
        }
      } else {
        await supabase.from("broken_link_reports").insert({
          slug, episode_number: epNum, report_type: type,
          anime_title: animeTitle, anime_cover: animeCover, anilist_id: anilistId,
        });
      }

      toast.success("Reporte enviado. ¡Gracias!");
      setOpen(false);
    } catch (e: any) {
      toast.error("Error al reportar");
    }
    setSending(false);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition">
        <AlertTriangle className="w-3.5 h-3.5" /> Reportar enlace caído
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setOpen(false)}>
          <div className="bg-card w-full max-w-sm rounded-2xl border border-border shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black text-foreground flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-destructive" /> Reportar problema
                </h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>

              <p className="text-xs text-muted-foreground">¿Qué deseas reportar?</p>

              <button onClick={() => report("episode")} disabled={sending}
                className="w-full py-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-bold hover:bg-destructive/20 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Capítulo {episodeNumber} no funciona
              </button>

              <button onClick={() => report("full")} disabled={sending}
                className="w-full py-3 rounded-xl bg-yellow-600/10 border border-yellow-600/30 text-yellow-400 text-sm font-bold hover:bg-yellow-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50">
                {sending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Anime completo no funciona
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
