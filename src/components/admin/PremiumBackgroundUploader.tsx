import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { compressToWebp } from "@/lib/image-compress";

const SETTINGS_KEY = "premium_bg_url";
const BUCKET = "premium-assets";

export default function PremiumBackgroundUploader() {
  const [url, setUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("app_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
    setUrl(((data?.value as string) || "").trim());
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async (newUrl: string) => {
    const { error } = await supabase.from("app_settings").upsert(
      { key: SETTINGS_KEY, value: newUrl, description: "Fondo decorativo de Obtener Premium" },
      { onConflict: "key" }
    );
    if (error) throw error;
  };

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const blob = await compressImageToWebp(file, { maxDim: 1920, quality: 0.85 });
      const path = `premium-bg/bg-${Date.now()}.webp`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      await save(pub.publicUrl);
      setUrl(pub.publicUrl);
      toast.success("Fondo actualizado");
    } catch (e: any) {
      toast.error(e.message || "Error al subir imagen");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm("¿Eliminar fondo actual?")) return;
    try {
      await save("");
      setUrl("");
      toast.success("Fondo eliminado");
    } catch (e: any) {
      toast.error(e.message || "Error");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-secondary/60 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <ImageIcon className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Fondo de Obtener Premium</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Imagen decorativa que aparece detrás de los planes. Se comprime automáticamente a WebP.
      </p>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          {url ? (
            <div className="relative rounded-lg overflow-hidden border border-border aspect-[16/7] bg-background">
              <img src={url} alt="Fondo actual" className="w-full h-full object-cover" loading="lazy" />
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border bg-background/40 aspect-[16/7] flex items-center justify-center text-xs text-muted-foreground">
              Sin fondo configurado
            </div>
          )}

          <div className="flex gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <button
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
            >
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {url ? "Cambiar imagen" : "Subir imagen"}
            </button>
            {url && (
              <button
                onClick={handleRemove}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-destructive/50 text-destructive text-xs font-bold hover:bg-destructive/10"
              >
                <Trash2 className="w-3.5 h-3.5" /> Quitar
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
