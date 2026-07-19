import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Upload, Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RARITY_META, type Rarity } from "@/lib/cosmetics";
import AvatarFrame from "@/components/premium/AvatarFrame";
import { compressFramePng } from "@/lib/image-compress";
import { uploadCosmeticToR2 } from "@/lib/upload-cosmetic";

const FRAME_SHAPES = ["circle","hex","diamond","rounded","shield","star"] as const;
type Shape = typeof FRAME_SHAPES[number];

interface FrameRow {
  id: string;
  name: string;
  image_url: string | null;
  shape: Shape;
  rarity: Rarity;
  requirement_type: "free" | "level" | "premium" | "gacha";
  requirement_value: number;
  position: number;
  active: boolean;
}

export default function AdminFramesManager() {
  const [items, setItems] = useState<FrameRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("admin_frames" as any).select("*").order("position", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as any as FrameRow[]) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createEmpty = async () => {
    const { error } = await supabase.from("admin_frames" as any).insert({
      name: "Marco sin nombre", shape: "circle", rarity: "basico", position: items.length,
      requirement_type: "gacha", requirement_value: 0, active: true,
    });
    if (error) return toast.error(error.message);
    load();
  };

  const handleUpload = async (id: string, rawFile: File) => {
    setUploading(true);
    try {
      const file = await compressFramePng(rawFile);
      const publicUrl = await uploadCosmeticToR2(file, "frames", file.name);
      await patch(id, { image_url: publicUrl });
      toast.success("Overlay actualizado");
    } catch (e: any) { toast.error(e?.message ?? "error"); }
    finally { setUploading(false); }
  };

  const patch = async (id: string, p: Partial<FrameRow>) => {
    setItems((s) => s.map((i) => (i.id === id ? { ...i, ...p } : i)));
    const { error } = await supabase.from("admin_frames" as any).update(p).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este marco?")) return;
    const { error } = await supabase.from("admin_frames" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Marcos de avatar</h2>
          <p className="text-sm text-muted-foreground">Sube PNG transparentes que rodeen el avatar (recomendado 512x512). Elige forma y rareza.</p>
        </div>
        <button onClick={createEmpty} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium">
          <Plus className="w-4 h-4" /> Nuevo marco
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aún no hay marcos. Crea el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((f) => {
            const meta = RARITY_META[f.rarity];
            return (
              <div key={f.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-4">
                  <AvatarFrame frame={`admin:${f.id}`} size={72}>
                    <div className="w-full h-full bg-gradient-to-br from-primary/40 to-accent/20" />
                  </AvatarFrame>
                  <div className="flex-1 min-w-0 space-y-2">
                    <Input value={f.name} onChange={(e) => patch(f.id, { name: e.target.value })} className="h-8 text-sm" />
                    <span className="rarity-chip" style={{ color: meta.color }}>{meta.label}</span>
                  </div>
                  <button onClick={() => patch(f.id, { active: !f.active })} className="p-2 rounded-md hover:bg-muted" title={f.active ? "Ocultar" : "Mostrar"}>
                    {f.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs">
                    <span className="text-muted-foreground">Forma</span>
                    <select value={f.shape} onChange={(e) => patch(f.id, { shape: e.target.value as Shape })}
                      className="w-full mt-1 h-8 text-xs rounded-md border border-border bg-background px-2">
                      {FRAME_SHAPES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="text-xs">
                    <span className="text-muted-foreground">Rareza</span>
                    <select value={f.rarity} onChange={(e) => patch(f.id, { rarity: e.target.value as Rarity })}
                      className="w-full mt-1 h-8 text-xs rounded-md border border-border bg-background px-2">
                      {(Object.keys(RARITY_META) as Rarity[]).map((r) =>
                        <option key={r} value={r}>{RARITY_META[r].label} ({(RARITY_META[r].chance*100).toFixed(1)}%)</option>)}
                    </select>
                  </label>
                  <label className="text-xs col-span-2">
                    <span className="text-muted-foreground">Requisito</span>
                    <div className="flex gap-2 mt-1">
                      <select value={f.requirement_type} onChange={(e) => patch(f.id, { requirement_type: e.target.value as any })}
                        className="flex-1 h-8 text-xs rounded-md border border-border bg-background px-2">
                        <option value="free">Gratis</option>
                        <option value="level">Por nivel</option>
                        <option value="premium">Premium</option>
                        <option value="gacha">Solo gachapón</option>
                      </select>
                      <Input type="number" min={0} value={f.requirement_value}
                        onChange={(e) => patch(f.id, { requirement_value: parseInt(e.target.value) || 0 })}
                        disabled={f.requirement_type !== "level"} className="h-8 w-24 text-xs" placeholder="Nvl" />
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border">
                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer text-primary hover:underline">
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{f.image_url ? "Cambiar overlay PNG" : "Subir overlay PNG"}</span>
                    <input type="file" accept="image/png,image/webp" className="hidden"
                      onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(f.id, file); e.target.value = ""; }} />
                  </label>
                  <button onClick={() => remove(f.id)} className="text-destructive hover:opacity-80 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
