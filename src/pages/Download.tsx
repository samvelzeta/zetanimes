import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Share2, Smartphone, Shield, Zap, Tv, ArrowLeft, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/zetanime-logo.png";

const APK_SETTING_KEY = "apk_download_url";
const FALLBACK_APK = "https://github.com/zetanime/app/releases/latest/download/zetanime.apk";

export default function DownloadPage() {
  const [apkUrl, setApkUrl] = useState(FALLBACK_APK);
  const [version, setVersion] = useState("1.0.0");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    document.title = "Descargar zetAnime APK – Anime sin límites";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Descarga la app oficial de zetAnime para Android. Mira anime sub y latino sin anuncios desde tu TV o móvil.");

    supabase
      .from("app_settings")
      .select("key,value")
      .in("key", [APK_SETTING_KEY, "apk_version"])
      .then(({ data }) => {
        if (!data) return;
        const url = data.find((r: any) => r.key === APK_SETTING_KEY)?.value;
        const ver = data.find((r: any) => r.key === "apk_version")?.value;
        if (url) setApkUrl(url);
        if (ver) setVersion(ver);
      });
  }, []);

  const shareLink = async () => {
    const url = `${window.location.origin}/download`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "zetAnime APK", text: "Descarga la app de zetAnime", url });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Link copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }} />
      </div>

      {/* Back button */}
      <Link to="/" className="absolute top-4 left-4 z-10 w-10 h-10 rounded-full bg-secondary/80 backdrop-blur-sm flex items-center justify-center hover:bg-secondary transition">
        <ArrowLeft className="w-5 h-5" />
      </Link>

      <div className="relative z-10 max-w-md mx-auto px-6 pt-16 pb-12">
        {/* Hero logo */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div
              className="absolute inset-[-20px] rounded-full animate-pulse"
              style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.4) 0%, transparent 70%)" }}
            />
            <div
              className="relative w-32 h-32 rounded-3xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-transparent border-2 border-primary/40"
              style={{ boxShadow: "0 0 60px hsl(var(--primary) / 0.5)" }}
            >
              <img src={logoUrl} alt="zetAnime" className="w-24 h-24 object-contain" />
            </div>
          </div>

          <h1 className="text-4xl font-black text-foreground mb-2 tracking-tight">
            zet<span className="text-primary">Anime</span>
          </h1>
          <p className="text-sm text-muted-foreground mb-1">App oficial Android · v{version}</p>
          <p className="text-xs text-muted-foreground/70">Anime sub & latino · TV y móvil</p>

          {/* Download button */}
          <a
            href={apkUrl}
            download="zetanime.apk"
            className="mt-8 group relative w-full max-w-xs"
            onClick={() => toast.success("Iniciando descarga…")}
          >
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-60 group-hover:opacity-100 transition"
              style={{ background: "hsl(var(--primary))" }}
            />
            <div className="relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-primary text-primary-foreground font-black text-base shadow-2xl hover:scale-[1.02] active:scale-95 transition">
              <Download className="w-5 h-5" /> Descargar APK
            </div>
          </a>

          {/* Share button */}
          <button
            onClick={shareLink}
            className="mt-3 w-full max-w-xs flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-secondary border border-border text-foreground text-sm font-bold hover:bg-muted transition"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? "Copiado" : "Compartir enlace"}
          </button>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-2 gap-3">
          {[
            { icon: Zap, label: "Sin recargas", desc: "Modo WebView optimizado" },
            { icon: Tv, label: "Smart TV", desc: "Navegación con control" },
            { icon: Shield, label: "Sin anuncios*", desc: "Premium libre" },
            { icon: Smartphone, label: "Liviana", desc: "< 5 MB" },
          ].map((f) => (
            <div key={f.label} className="bg-secondary/60 rounded-2xl p-4 border border-border">
              <f.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm font-bold text-foreground">{f.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Install steps */}
        <div className="mt-8 bg-secondary/40 rounded-2xl p-5 border border-border">
          <h2 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" /> Cómo instalar
          </h2>
          <ol className="space-y-2 text-xs text-muted-foreground">
            {[
              'Toca "Descargar APK" arriba',
              "En Ajustes de Android, permite instalar de orígenes desconocidos",
              "Abre el archivo descargado e instala",
              "¡Listo! Inicia sesión con tu cuenta",
            ].map((step, i) => (
              <li key={i} className="flex gap-2">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <p className="text-center text-[10px] text-muted-foreground/60 mt-6">
          *Los anuncios se desactivan al ser usuario Premium.
        </p>
      </div>
    </div>
  );
}
