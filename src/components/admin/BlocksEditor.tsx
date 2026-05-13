import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listBlocks, saveBlocks, invalidateBlocksCache, type VideoBlock } from "@/lib/video-blocks";
import { clearRuntimeVideoCache } from "@/lib/video-cache";
import { clearSeekeEpisodeCache } from "@/lib/zetapi";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface Props {
  anilistId: number;
  slug: string;
  lang: "sub" | "latino";
}

interface Row {
  block_label: string;
  episode_from: number;
  episode_to: number;
  seeke_base_url: string;
  source_episode_offset: number;
}

export default function BlocksEditor({ anilistId, slug, lang }: Props) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const blocks = await listBlocks(anilistId, lang);
    if (blocks.length) {
      setEnabled(true);
      setRows(blocks.map((b: VideoBlock) => ({
        block_label: b.block_label || "",
        episode_from: b.episode_from,
        episode_to: b.episode_to,
        seeke_base_url: b.seeke_base_url,
      })));
    } else {
      setEnabled(false);
      setRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [anilistId, lang]);

  const addRow = () => {
    const last = rows[rows.length - 1];
    const start = last ? last.episode_to + 1 : 1;
    setRows([...rows, { block_label: "", episode_from: start, episode_to: start + 24, seeke_base_url: "" }]);
  };

  const updateRow = (idx: number, patch: Partial<Row>) => {
    setRows(rows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };

  const removeRow = (idx: number) => setRows(rows.filter((_, i) => i !== idx));

  const save = async () => {
    setSaving(true);
    const res = await saveBlocks(anilistId, slug, lang, rows, user?.id);
    if (!res.success) {
      toast.error(res.error || "Error guardando bloques");
      setSaving(false);
      return;
    }
    // Invalidar cache de videos cacheados específicos para forzar re-pedir con la URL correcta
    await supabase.from("video_cache").delete().eq("anilist_id", anilistId).eq("lang", lang).neq("episode", 0);
    clearRuntimeVideoCache();
    clearSeekeEpisodeCache();
    invalidateBlocksCache(anilistId, lang);
    toast.success(`${rows.length} bloque(s) guardado(s) para ${lang}`);
    setSaving(false);
  };

  const disable = async () => {
    if (!confirm("¿Eliminar todos los bloques de este idioma? Volverá a usarse la URL madre única.")) return;
    setSaving(true);
    await saveBlocks(anilistId, slug, lang, [], user?.id);
    setRows([]);
    setEnabled(false);
    invalidateBlocksCache(anilistId, lang);
    toast.success("Bloques eliminados");
    setSaving(false);
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground p-3"><Loader2 className="w-3 h-3 animate-spin" /> Cargando bloques...</div>;

  return (
    <div className="border border-primary/30 rounded-xl p-3 bg-secondary/40 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold text-foreground">Animes en bloques · {lang === "latino" ? "🌎 Latino" : "🇯🇵 Sub"}</p>
        </div>
        {!enabled ? (
          <button onClick={() => { setEnabled(true); if (!rows.length) addRow(); }} className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary font-bold">
            Activar modo bloques
          </button>
        ) : (
          <button onClick={disable} disabled={saving} className="text-[10px] px-2 py-1 rounded bg-destructive/20 text-destructive font-bold">
            Desactivar
          </button>
        )}
      </div>

      <p className="text-[10px] text-muted-foreground">
        Para series divididas por temporadas en la fuente externa (ej. Black Clover). Cada bloque mapea un rango de episodios → su URL madre Seeke. El usuario sigue viendo numeración continua.
      </p>

      {enabled && (
        <>
          <div className="space-y-2">
            {rows.map((r, i) => (
              <div key={i} className="grid grid-cols-[1fr_auto] gap-2 bg-background/50 rounded-lg p-2 border border-border">
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <Input value={r.block_label} onChange={(e) => updateRow(i, { block_label: e.target.value })} placeholder={`Bloque ${i + 1} (etiqueta opcional)`} className="h-8 text-xs flex-1" />
                    <Input type="number" min={1} value={r.episode_from} onChange={(e) => updateRow(i, { episode_from: Number(e.target.value) })} placeholder="Desde" className="h-8 text-xs w-20" />
                    <Input type="number" min={1} value={r.episode_to} onChange={(e) => updateRow(i, { episode_to: Number(e.target.value) })} placeholder="Hasta" className="h-8 text-xs w-20" />
                  </div>
                  <Input value={r.seeke_base_url} onChange={(e) => updateRow(i, { seeke_base_url: e.target.value })} placeholder="https://flixlat.com/.../detail/..." className="h-8 text-xs font-mono" />
                </div>
                <button onClick={() => removeRow(i)} className="self-start text-destructive hover:bg-destructive/10 p-1.5 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={addRow} className="flex-1 py-2 rounded-lg bg-secondary border border-primary/30 text-xs font-bold text-primary flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Agregar bloque
            </button>
            <button onClick={save} disabled={saving || rows.length === 0} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar bloques
            </button>
          </div>
        </>
      )}
    </div>
  );
}
