import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2, Save, ExternalLink, Smartphone, Lock } from "lucide-react";
import { toast } from "sonner";

export default function ApkManager() {
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [hasEncrypted, setHasEncrypted] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("key,value")
      .in("key", ["apk_download_url_enc", "apk_version"])
      .then(({ data }) => {
        if (!data) return;
        const enc = data.find((r: any) => r.key === "apk_download_url_enc")?.value;
        setHasEncrypted(!!enc);
        setVersion(data.find((r: any) => r.key === "apk_version")?.value || "1.0.0");
      });
  }, []);

  const save = async () => {
    if (!url && !hasEncrypted) {
      toast.error("Ingresa la URL del APK");
      return;
    }
    setLoading(true);
    try {
      const payload: any = { version };
      if (url) payload.url = url;
      const { error } = await supabase.functions.invoke("apk-set-url", {
        body: payload,
      });
      if (error) throw error;
      toast.success("APK guardado y cifrado de forma segura");
      setUrl("");
      setHasEncrypted(true);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo guardar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-primary" /> Configurar APK
      </h3>

      <div>
        <label className="text-[10px] text-primary mb-1 block font-bold flex items-center gap-1">
          <Lock className="w-3 h-3" /> URL real del APK (se cifra al guardar)
        </label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={hasEncrypted ? "•••••••• cifrado (escribe nueva para reemplazar)" : "https://github.com/.../zetanime.apk"}
          className="h-10 bg-secondary border-primary/30 rounded-xl"
        />
        {hasEncrypted && (
          <p className="text-[10px] text-muted-foreground mt-1">
            ✅ Hay un APK cifrado guardado. Solo el servidor puede descifrarlo.
          </p>
        )}
      </div>

      <div>
        <label className="text-[10px] text-primary mb-1 block font-bold">Versión actual</label>
        <Input
          value={version}
          onChange={(e) => setVersion(e.target.value)}
          placeholder="1.0.0"
          className="h-10 bg-secondary border-primary/30 rounded-xl"
        />
      </div>

      <div className="flex gap-2">
        <button onClick={save} disabled={loading} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          <Save className="w-4 h-4" /> Guardar cifrado
        </button>
        <a href="/download" target="_blank" rel="noopener" className="px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm font-bold flex items-center gap-2">
          <ExternalLink className="w-4 h-4" /> Ver
        </a>
      </div>

      <p className="text-[10px] text-muted-foreground">
        El enlace público es: <code className="text-primary">{window.location.origin}/download</code>
        <br />
        El origen real del APK queda oculto: el usuario descarga desde tu dominio mediante un token temporal.
      </p>
    </div>
  );
}
