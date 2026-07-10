import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2, Plus, Upload, Loader2, Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { RARITY_META, type Rarity } from "@/lib/cosmetics";

interface Banner {
  id: string;
  name: string;
  image_url: string;
  requirement_type: "free" | "level" | "premium" | "gacha";
  requirement_value: number;
  rarity: Rarity;
  position: number;
  active: boolean;
}

export default function AdminBannersManager() {
  const [items, setItems] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("admin_banners" as any)
      .select("*")
      .order("position", { ascending: true });
    if (error) toast.error(error.message);
    setItems((data as any as Banner[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("premium-assets")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("premium-assets").getPublicUrl(path);
      const { error: insErr } = await supabase.from("admin_banners" as any).insert({
        name: file.name.replace(/\.[^.]+$/, ""),
        image_url: pub.publicUrl,
        requirement_type: "free",
        requirement_value: 0,
        position: items.length,
        active: true,
      });
      if (insErr) throw insErr;
      toast.success("Banner subido");
      await load();
    } catch (err: any) {
      toast.error("Error: " + (err?.message ?? "desconocido"));
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const patch = async (id: string, patch: Partial<Banner>) => {
    setItems((s) => s.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    const { error } = await supabase.from("admin_banners" as any).update(patch).eq("id", id);
    if (error) { toast.error(error.message); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("¿Eliminar este banner?")) return;
    const { error } = await supabase.from("admin_banners" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Banner eliminado");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Banners de perfil</h2>
          <p className="text-sm text-muted-foreground">Imágenes que los usuarios pueden usar de fondo en su perfil.</p>
        </div>
        <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground cursor-pointer hover:opacity-90 transition text-sm font-medium">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          <span>Subir banner</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleUpload} disabled={uploading} />
        </label>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl">
          <Upload className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Aún no hay banners. Sube el primero.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((b) => (
            <div key={b.id} className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="relative aspect-[16/6] bg-muted" style={{ background: `url("${b.image_url}") center/cover no-repeat` }}>
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                <span className="absolute bottom-2 left-2 text-white text-sm font-semibold">{b.name}</span>
                <button onClick={() => patch(b.id, { active: !b.active })}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-black/50 text-white hover:bg-black/70"
                  title={b.active ? "Ocultar" : "Mostrar"}>
                  {b.active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
              </div>
              <div className="p-3 space-y-2">
                <Input value={b.name} onChange={(e) => patch(b.id, { name: e.target.value })} className="h-8 text-sm" />
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={b.requirement_type}
                    onChange={(e) => patch(b.id, { requirement_type: e.target.value as any })}
                    className="col-span-2 h-8 text-xs rounded-md border border-border bg-background px-2"
                  >
                    <option value="free">Gratis</option>
                    <option value="level">Por nivel</option>
                    <option value="premium">Premium</option>
                  </select>
                  <Input
                    type="number"
                    min={0}
                    value={b.requirement_value}
                    onChange={(e) => patch(b.id, { requirement_value: parseInt(e.target.value) || 0 })}
                    disabled={b.requirement_type !== "level"}
                    className="h-8 text-xs"
                    placeholder="Nivel"
                  />
                </div>
                <div className="flex justify-between items-center pt-1">
                  <span className={`text-xs ${b.active ? "text-emerald-500" : "text-muted-foreground"}`}>
                    {b.active ? "Activo" : "Oculto"}
                  </span>
                  <button onClick={() => remove(b.id)} className="text-destructive hover:text-destructive/80 p-1">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
