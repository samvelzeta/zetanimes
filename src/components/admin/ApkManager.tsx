import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Loader2, Save, ExternalLink, Smartphone } from "lucide-react";
import { toast } from "sonner";

const KEYS = ["apk_download_url", "apk_version"];

export default function ApkManager() {
  const [url, setUrl] = useState("");
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("app_settings").select("key,value").in("key", KEYS).then(({ data }) => {
      if (!data) return;
      setUrl(data.find((r: any) => r.key === "apk_download_url")?.value || "");
      setVersion(data.find((r: any) => r.key === "apk_version")?.value || "1.0.0");
    });
  }, []);

  const save = async () => {
    setLoading(true);
    const ops = [
      supabase.from("app_settings").upsert({ key: "apk_download_url", value: url }, { onConflict: "key" }),
      supabase.from("app_settings").upsert({ key: "apk_version", value: version }, { onConflict: "key" }),
    ];
    await Promise.all(ops);
    setLoading(false);
    toast.success("Configuración APK guardada");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-primary" /> Configurar APK
      </h3>

      <div>
        <label className="text-[10px] text-primary mb-1 block font-bold">URL de descarga del APK</label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/.../zetanime.apk"
          className="h-10 bg-secondary border-primary/30 rounded-xl"
        />
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
          <Save className="w-4 h-4" /> Guardar
        </button>
        <a href="/download" target="_blank" rel="noopener" className="px-4 py-3 rounded-xl bg-secondary border border-border text-foreground text-sm font-bold flex items-center gap-2">
          <ExternalLink className="w-4 h-4" /> Ver
        </a>
      </div>

      <p className="text-[10px] text-muted-foreground">
        El enlace público para compartir es: <code className="text-primary">{window.location.origin}/download</code>
      </p>
    </div>
  );
}
