import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { getSlugOverride, saveSlugOverride, deleteSlugOverride } from "@/lib/slug-overrides";

interface Props {
  anilistId: number;
  animeTitle: string;
  coverImage?: string;
}

/**
 * Mini-panel solo visible para el owner en la página del anime.
 * Permite ver, crear, editar o eliminar el slug manual del anime actual.
 * Si se elimina, el sistema vuelve a resolver el slug normalmente
 * (AniList → Jikan/Kitsu/Shikimori → fallback).
 */
export default function SlugOverrideAdmin({ anilistId, animeTitle, coverImage }: Props) {
  const { isOwner, user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!isOwner || !anilistId) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      const ov = await getSlugOverride(anilistId);
      if (cancel) return;
      setCurrent(ov);
      setSlug(ov || "");
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [isOwner, anilistId]);

  if (!isOwner) return null;

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["zet-slug-multi"] });
    await queryClient.invalidateQueries({ queryKey: ["anime-detail", anilistId] });
    // Purga el caché de streams (memoria del edge + Cloudflare KV) del anime.
    await invalidateStreamCache(anilistId);
  };


  const handleSave = async () => {
    const clean = slug.trim().toLowerCase();
    if (!clean) return toast.error("Slug vacío");
    setSaving(true);
    const ok = await saveSlugOverride({
      anilist_id: anilistId,
      manual_slug: clean,
      anime_title: animeTitle,
      cover_image: coverImage,
      notes,
      created_by: user?.id,
    });
    setSaving(false);
    if (ok) {
      toast.success("Slug guardado para este anime");
      setCurrent(clean);
      await invalidate();
    } else toast.error("Error al guardar");
  };

  const handleDelete = async () => {
    if (!confirm("¿Eliminar el slug manual? Volverá a resolverse automáticamente.")) return;
    setSaving(true);
    const ok = await deleteSlugOverride(anilistId);
    setSaving(false);
    if (ok) {
      toast.success("Override eliminado, se usará la resolución automática");
      setCurrent(null);
      setSlug("");
      setNotes("");
      await invalidate();
    } else toast.error("Error al eliminar");
  };

  return (
    <div className="mt-4 rounded-xl border border-primary/30 bg-secondary/60 backdrop-blur-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-primary/10 transition"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Wand2 className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-foreground">Slug manual (admin)</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {loading ? "Cargando…" : current ? <>activo: <span className="text-primary font-mono">{current}</span></> : "sin override (resolución automática)"}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-primary font-bold">{open ? "ocultar" : "editar"}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-primary/20 pt-3">
          <div>
            <label className="text-[10px] text-primary font-bold mb-1 block">Slug del scraper</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ej. hunter-x-hunter-2011"
              className="h-9 bg-background border-primary/30 rounded-lg font-mono text-xs"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Solo se aplica a este anime (AniList ID <span className="font-mono">{anilistId}</span>). Si lo eliminas, vuelve a usarse la resolución automática.
            </p>
          </div>
          <div>
            <label className="text-[10px] text-primary font-bold mb-1 block">Notas (opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-14 bg-background border border-primary/30 rounded-lg p-2 text-xs text-foreground resize-none"
              placeholder="Por qué fue necesario este override…"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
            {current && (
              <button
                onClick={handleDelete}
                disabled={saving}
                className="py-2 px-3 rounded-lg bg-destructive/20 text-destructive font-bold text-xs flex items-center gap-1.5 hover:bg-destructive/30 disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" /> Borrar
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="py-2 px-3 rounded-lg bg-muted text-muted-foreground font-bold text-xs flex items-center gap-1.5 hover:bg-muted/80"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
