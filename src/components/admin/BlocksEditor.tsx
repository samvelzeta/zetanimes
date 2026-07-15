import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Layers, ArrowLeftRight, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { listBlocksAdmin, saveBlocks, invalidateBlocksCache, type VideoBlock } from "@/lib/video-blocks";
import { clearRuntimeVideoCache } from "@/lib/video-cache";
import { clearSeekeEpisodeCache } from "@/lib/zetapi";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  anilistId: number;
  slug: string;
  lang: "sub" | "latino";
}

interface NormalRow {
  block_label: string;
  episode_from: number;
  episode_to: number;
  seeke_base_url: string;
}

interface InverseConfig {
  enabled: boolean;
  episode_to: number;        // cuántos caps tiene esta temporada en mi página (1..N)
  seeke_base_url: string;    // URL madre unificada en Seeke
  start_in_seeke: number;    // a partir de qué cap real arranca en Seeke (ej. 25)
  block_label: string;
}

export default function BlocksEditor({ anilistId, slug, lang }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [overlapPrompt, setOverlapPrompt] = useState<null | { message: string; retry: () => Promise<void> }>(null);


  // ---- MODO NORMAL ----
  const [normalEnabled, setNormalEnabled] = useState(false);
  const [normalRows, setNormalRows] = useState<NormalRow[]>([]);

  // ---- MODO INVERSO (separado) ----
  const [inverse, setInverse] = useState<InverseConfig>({
    enabled: false,
    episode_to: 24,
    seeke_base_url: "",
    start_in_seeke: 25,
    block_label: "",
  });

  const load = async () => {
    setLoading(true);
    const blocks = await listBlocksAdmin(anilistId, lang);
    // Detectar si hay un bloque inverso (offset > 0)
    const inverseBlock = blocks.find((b) => Number(b.source_episode_offset || 0) > 0 || b.inverse_mode);
    const normals = blocks.filter((b) => b !== inverseBlock);

    if (inverseBlock) {
      setInverse({
        enabled: true,
        episode_to: inverseBlock.episode_to,
        seeke_base_url: inverseBlock.seeke_base_url,
        start_in_seeke: Number(inverseBlock.source_episode_offset || 0) + 1,
        block_label: inverseBlock.block_label || "",
      });
    } else {
      setInverse({ enabled: false, episode_to: 24, seeke_base_url: "", start_in_seeke: 25, block_label: "" });
    }

    if (normals.length) {
      setNormalEnabled(true);
      setNormalRows(normals.map((b: VideoBlock) => ({
        block_label: b.block_label || "",
        episode_from: b.episode_from,
        episode_to: b.episode_to,
        seeke_base_url: b.seeke_base_url,
      })));
    } else {
      setNormalEnabled(false);
      setNormalRows([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [anilistId, lang]);

  // ---- helpers normales ----
  const addNormalRow = () => {
    const last = normalRows[normalRows.length - 1];
    const start = last ? last.episode_to + 1 : 1;
    setNormalRows([...normalRows, { block_label: "", episode_from: start, episode_to: start + 24, seeke_base_url: "" }]);
  };
  const updateNormalRow = (idx: number, patch: Partial<NormalRow>) => {
    setNormalRows(normalRows.map((r, i) => i === idx ? { ...r, ...patch } : r));
  };
  const removeNormalRow = (idx: number) => {
    if (normalRows[idx]?.seeke_base_url?.trim()) {
      toast.error("Ese bloque madre está protegido. Reemplaza su URL o rango, no lo borres.");
      return;
    }
    setNormalRows(normalRows.filter((_, i) => i !== idx));
  };

  // Construye el payload combinado y guarda
  const persist = async (next: { normals: NormalRow[]; inv: InverseConfig | null }) => {
    setSaving(true);
    const payload: Array<{ block_label?: string | null; episode_from: number; episode_to: number; seeke_base_url: string; source_episode_offset?: number; inverse_mode?: boolean }> = [];

    next.normals.forEach((r) => {
      payload.push({
        block_label: r.block_label || null,
        episode_from: r.episode_from,
        episode_to: r.episode_to,
        seeke_base_url: r.seeke_base_url,
        source_episode_offset: 0,
        inverse_mode: false,
      });
    });

    if (next.inv && next.inv.enabled) {
      const offset = Math.max(0, next.inv.start_in_seeke - 1);
      payload.push({
        block_label: next.inv.block_label || null,
        episode_from: 1,
        episode_to: next.inv.episode_to,
        seeke_base_url: next.inv.seeke_base_url,
        source_episode_offset: offset,
        inverse_mode: true,
      });
    }

    const res = await saveBlocks(anilistId, slug, lang, payload, user?.id);
    if (!res.success) {
      toast.error(res.error || "Error guardando bloques");
      setSaving(false);
      return false;
    }
    await supabase.from("video_cache").delete().eq("anilist_id", anilistId).eq("lang", lang).neq("episode", 0).is("sources->seeke", null);
    clearRuntimeVideoCache();
    clearSeekeEpisodeCache();
    invalidateBlocksCache(anilistId, lang);
    toast.success(`Bloques guardados para ${lang}`);
    setSaving(false);
    return true;
  };

  const saveNormal = async () => {
    const inv = inverse.enabled ? inverse : null;
    await persist({ normals: normalRows, inv });
  };

  const saveInverse = async () => {
    if (!inverse.seeke_base_url.trim()) { toast.error("Falta URL madre Seeke"); return; }
    if (inverse.episode_to < 1) { toast.error("Caps en mi página inválido"); return; }
    if (inverse.start_in_seeke < 1) { toast.error("Cap de inicio Seeke inválido"); return; }
    await persist({ normals: normalEnabled ? normalRows : [], inv: { ...inverse, enabled: true } });
  };

  const disableNormal = async () => {
    toast.error("Los enlaces madre por bloques están protegidos. Reemplázalos editando la URL, no borrándolos.");
  };

  const disableInverse = async () => {
    toast.error("El enlace madre inverso está protegido. Reemplázalo editando la URL, no borrándolo.");
  };

  if (loading) return <div className="flex items-center gap-2 text-xs text-muted-foreground p-3"><Loader2 className="w-3 h-3 animate-spin" /> Cargando bloques...</div>;

  return (
    <div className="space-y-3">
      {/* ===================== MODO NORMAL ===================== */}
      <div className="border border-primary/30 rounded-xl p-3 bg-secondary/40 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" />
            <p className="text-xs font-bold text-foreground">Bloques NORMAL · {lang === "latino" ? "🌎 Latino" : "🇯🇵 Sub"}</p>
          </div>
          {!normalEnabled ? (
            <button onClick={() => { setNormalEnabled(true); if (!normalRows.length) addNormalRow(); }} className="text-[10px] px-2 py-1 rounded bg-primary/20 text-primary font-bold">
              Activar
            </button>
          ) : (
            <button onClick={disableNormal} disabled={saving} className="text-[10px] px-2 py-1 rounded bg-destructive/20 text-destructive font-bold">
              Desactivar
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Serie <strong>dividida</strong> por temporadas en Seeke pero <strong>unida</strong> en mi página (ej. Black Clover). Cada bloque apunta a una URL madre distinta.
        </p>

        {normalEnabled && (
          <>
            <div className="space-y-2">
              {normalRows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto] gap-2 bg-background/50 rounded-lg p-2 border border-border">
                  <div className="space-y-1.5">
                    <div className="flex gap-2">
                      <Input value={r.block_label} onChange={(e) => updateNormalRow(i, { block_label: e.target.value })} placeholder={`Bloque ${i + 1} (etiqueta)`} className="h-8 text-xs flex-1" />
                      <Input type="number" min={1} value={r.episode_from} onChange={(e) => updateNormalRow(i, { episode_from: Number(e.target.value) })} placeholder="Desde" className="h-8 text-xs w-20" />
                      <Input type="number" min={1} value={r.episode_to} onChange={(e) => updateNormalRow(i, { episode_to: Number(e.target.value) })} placeholder="Hasta" className="h-8 text-xs w-20" />
                    </div>
                    <Input value={r.seeke_base_url} onChange={(e) => updateNormalRow(i, { seeke_base_url: e.target.value })} placeholder="https://flixlat.com/.../detail/..." className="h-8 text-xs font-mono" />
                  </div>
                  <button onClick={() => removeNormalRow(i)} className="self-start text-destructive hover:bg-destructive/10 p-1.5 rounded">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={addNormalRow} className="flex-1 py-2 rounded-lg bg-secondary border border-primary/30 text-xs font-bold text-primary flex items-center justify-center gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Agregar bloque
              </button>
              <button onClick={saveNormal} disabled={saving || normalRows.length === 0} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar normal
              </button>
            </div>
          </>
        )}
      </div>

      {/* ===================== MODO INVERSO ===================== */}
      <div className="border border-amber-500/40 rounded-xl p-3 bg-amber-500/5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-amber-500" />
            <p className="text-xs font-bold text-foreground">Bloque INVERSO · {lang === "latino" ? "🌎 Latino" : "🇯🇵 Sub"}</p>
          </div>
          {!inverse.enabled ? (
            <button onClick={() => setInverse({ ...inverse, enabled: true })} className="text-[10px] px-2 py-1 rounded bg-amber-500/20 text-amber-500 font-bold">
              Activar
            </button>
          ) : (
            <button onClick={disableInverse} disabled={saving} className="text-[10px] px-2 py-1 rounded bg-destructive/20 text-destructive font-bold">
              Desactivar
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Serie <strong>unida</strong> en Seeke (ej. 1–48 continuos) pero <strong>dividida</strong> en mi página por temporadas. Esta entrada es la T2 (caps 1–24 en mi página) que internamente pide a Seeke a partir del cap 25. Cap 1 → 25, cap 2 → 26, etc.
        </p>

        {inverse.enabled && (
          <div className="bg-background/50 rounded-lg p-2 border border-border space-y-2">
            <Input
              value={inverse.block_label}
              onChange={(e) => setInverse({ ...inverse, block_label: e.target.value })}
              placeholder="Etiqueta (ej. T2 unificada)"
              className="h-8 text-xs"
            />
            <Input
              value={inverse.seeke_base_url}
              onChange={(e) => setInverse({ ...inverse, seeke_base_url: e.target.value })}
              placeholder="URL madre Seeke unificada (1–48)"
              className="h-8 text-xs font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Caps en mi página (1..N)</label>
                <Input
                  type="number" min={1}
                  value={inverse.episode_to}
                  onChange={(e) => setInverse({ ...inverse, episode_to: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Mi cap 1 = Seeke cap</label>
                <Input
                  type="number" min={1}
                  value={inverse.start_in_seeke}
                  onChange={(e) => setInverse({ ...inverse, start_in_seeke: Number(e.target.value) })}
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="text-[10px] text-amber-500 font-bold">
              ⇄ Mi cap 1 → Seeke cap {inverse.start_in_seeke} · Mi cap {inverse.episode_to} → Seeke cap {inverse.start_in_seeke + inverse.episode_to - 1}
            </div>
            <button onClick={saveInverse} disabled={saving} className="w-full py-2 rounded-lg bg-amber-500 text-background text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar inverso
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
