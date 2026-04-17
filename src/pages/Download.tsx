import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Share2, Smartphone, Tv, Zap, Gauge, ArrowLeft, Check, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isTV } from "@/hooks/useIsTV";
import logoUrl from "@/assets/zetanime-apk-logo.png";

const APK_SETTING_KEY = "apk_download_url";
const FALLBACK_APK = "https://github.com/zetanime/app/releases/latest/download/zetanime.apk";
const BACKGROUND_VIDEO_URL = "https://www.dropbox.com/scl/fi/jjm661r08rfvpgkmqdkrc/videoback-anime-zetanime-1.mp4?rlkey=osecdinr9zos3nni8bgzmiq4e&st=sjzr8ts1&raw=1";
const LOADING_DOTS = [
  { left: 14, top: 18, size: 6, delay: 0.2, duration: 2.8 },
  { left: 25, top: 35, size: 8, delay: 0.7, duration: 3.4 },
  { left: 36, top: 22, size: 5, delay: 0.3, duration: 2.6 },
  { left: 48, top: 44, size: 7, delay: 1.1, duration: 3.1 },
  { left: 58, top: 19, size: 5, delay: 0.5, duration: 2.9 },
  { left: 68, top: 37, size: 9, delay: 1.5, duration: 3.6 },
  { left: 79, top: 24, size: 6, delay: 0.9, duration: 2.7 },
  { left: 84, top: 56, size: 7, delay: 0.4, duration: 3.3 },
  { left: 21, top: 63, size: 5, delay: 1.2, duration: 2.5 },
  { left: 39, top: 72, size: 8, delay: 0.8, duration: 3.2 },
  { left: 53, top: 61, size: 6, delay: 1.7, duration: 2.8 },
  { left: 65, top: 78, size: 5, delay: 0.6, duration: 3.5 },
  { left: 76, top: 68, size: 7, delay: 1.4, duration: 2.9 },
  { left: 88, top: 31, size: 6, delay: 1.9, duration: 3.4 },
];

export default function DownloadPage() {
  const [apkUrl, setApkUrl] = useState(FALLBACK_APK);
  const [version, setVersion] = useState("1.0.0");
  const [copied, setCopied] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [needsInteraction, setNeedsInteraction] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Device detection: TV vs Mobile/Desktop
  const device = useMemo(() => {
    if (typeof window === "undefined") return "mobile";
    if (isTV()) return "tv";
    const ua = navigator.userAgent || "";
    if (/Android|iPhone|iPad|Mobile/i.test(ua)) return "mobile";
    return "desktop";
  }, []);

  useEffect(() => {
    document.title = "Descargar zetAnime APK – Anime sin límites";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", "Descarga la app oficial de zetAnime para Android y Android TV. Mira anime sub y latino desde tu TV o móvil.");

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

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tryPlayWithAudio = async () => {
      try {
        video.muted = false;
        video.volume = 1;
        await video.play();
        setAudioReady(true);
        setNeedsInteraction(false);
      } catch {
        video.muted = true;
        try {
          await video.play();
        } catch {}
        setAudioReady(false);
        setNeedsInteraction(true);
      }
    };

    const onCanPlayThrough = () => {
      setVideoReady(true);
      void tryPlayWithAudio();
    };

    const enableAudioOnInteraction = async () => {
      const currentVideo = videoRef.current;
      if (!currentVideo || !needsInteraction) return;
      try {
        currentVideo.muted = false;
        currentVideo.volume = 1;
        await currentVideo.play();
        setAudioReady(true);
        setNeedsInteraction(false);
      } catch {}
    };

    video.addEventListener("canplaythrough", onCanPlayThrough);
    window.addEventListener("pointerdown", enableAudioOnInteraction, { passive: true });

    if (video.readyState >= 4) onCanPlayThrough();

    return () => {
      video.removeEventListener("canplaythrough", onCanPlayThrough);
      window.removeEventListener("pointerdown", enableAudioOnInteraction);
    };
  }, [needsInteraction]);

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

  const deviceLabel =
    device === "tv" ? "Android TV detectado" : device === "mobile" ? "Móvil detectado" : "Escritorio";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* === BACKGROUND VIDEO (YouTube no-cookie, oculto chrome) === */}
      <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none bg-black">
        <div
          className={`absolute inset-0 transition-opacity duration-1000 ${videoReady ? "opacity-0" : "opacity-100"}`}
          style={{ background: "radial-gradient(ellipse at center, hsl(16 100% 8%) 0%, hsl(0 0% 3%) 70%)" }}
        >
          {LOADING_DOTS.map((dot, index) => (
            <div
              key={`${dot.left}-${dot.top}-${index}`}
              className="absolute rounded-full bg-primary/60 animate-pulse"
              style={{
                left: `${dot.left}%`,
                top: `${dot.top}%`,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                animationDelay: `${dot.delay}s`,
                animationDuration: `${dot.duration}s`,
                boxShadow: "0 0 20px hsl(var(--primary) / 0.35)",
              }}
            />
          ))}
        </div>

        <video
          ref={videoRef}
          src={BACKGROUND_VIDEO_URL}
          loop
          playsInline
          preload="auto"
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${videoReady ? "opacity-100" : "opacity-0"}`}
        />

        <div className="absolute inset-0 bg-gradient-to-b from-background/85 via-background/70 to-background/95" />
        <div className={`absolute inset-0 transition-all duration-1000 ${videoReady ? "backdrop-blur-[1px]" : "backdrop-blur-[2px]"}`} />
      </div>

      {/* Glow accents */}
      <div className="absolute inset-0 pointer-events-none z-[1]">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }} />
      </div>

      {needsInteraction && videoReady && (
        <button
          onClick={async () => {
            const video = videoRef.current;
            if (!video) return;
            try {
              video.muted = false;
              video.volume = 1;
              await video.play();
              setAudioReady(true);
              setNeedsInteraction(false);
            } catch {
              toast.error("Toca de nuevo para activar el audio");
            }
          }}
          className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-4 py-2 text-xs font-bold text-foreground backdrop-blur-sm"
        >
          <Volume2 className="h-4 w-4 text-primary" /> Activar sonido
        </button>
      )}

      {/* Back button */}
      <Link to="/" className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-secondary/80 backdrop-blur-sm flex items-center justify-center hover:bg-secondary transition">
        <ArrowLeft className="w-5 h-5" />
      </Link>

      <div className="relative z-10 max-w-md mx-auto px-6 pt-16 pb-12">
        {/* Hero logo */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-6">
            <div
              className="absolute inset-[-30px] rounded-full animate-pulse"
              style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.5) 0%, transparent 70%)" }}
            />
            <img
              src={logoUrl}
              alt="zetAnime"
              className="relative w-36 h-36 object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.8)]"
            />
          </div>

          <h1 className="text-4xl font-black text-foreground mb-2 tracking-tight drop-shadow-lg">
            zet<span className="text-primary">Anime</span>
          </h1>
          <p className="text-sm text-foreground/90 mb-1 drop-shadow">App oficial Android · v{version}</p>
          <div className="flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-primary/20 border border-primary/40 backdrop-blur-sm">
            {device === "tv" ? <Tv className="w-3 h-3 text-primary" /> : <Smartphone className="w-3 h-3 text-primary" />}
            <span className="text-[10px] font-bold text-primary">{deviceLabel}{audioReady ? " · Audio activo" : ""}</span>
          </div>

          {/* Download button */}
          <a
            href={apkUrl}
            download="zetanime.apk"
            className="mt-8 group relative w-full max-w-xs"
            onClick={() => toast.success("Iniciando descarga…")}
          >
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-70 group-hover:opacity-100 transition"
              style={{ background: "hsl(var(--primary))" }}
            />
            <div className="relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-primary text-primary-foreground font-black text-base shadow-2xl hover:scale-[1.02] active:scale-95 transition">
              <Download className="w-5 h-5" /> Descargar APK
            </div>
          </a>

          {/* Share button */}
          <button
            onClick={shareLink}
            className="mt-3 w-full max-w-xs flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-secondary/70 backdrop-blur-sm border border-border text-foreground text-sm font-bold hover:bg-muted transition"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? "Copiado" : "Compartir enlace"}
          </button>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-2 gap-3">
          {[
            { icon: Zap, label: "Acceso rápido", desc: "WebView optimizado" },
            { icon: Tv, label: "Android TV", desc: "Detecta tu dispositivo" },
            { icon: Gauge, label: "Fluida", desc: "Sin recargas extra" },
            { icon: Smartphone, label: "Liviana", desc: "< 5 MB" },
          ].map((f) => (
            <div key={f.label} className="bg-secondary/60 backdrop-blur-md rounded-2xl p-4 border border-border">
              <f.icon className="w-5 h-5 text-primary mb-2" />
              <p className="text-sm font-bold text-foreground">{f.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Install steps */}
        <div className="mt-8 bg-secondary/50 backdrop-blur-md rounded-2xl p-5 border border-border">
          <h2 className="text-sm font-black text-foreground mb-3 flex items-center gap-2">
            <Download className="w-4 h-4 text-primary" /> Cómo instalar
          </h2>
          <ol className="space-y-2 text-xs text-muted-foreground">
            {[
              'Toca "Descargar APK" arriba',
              device === "tv"
                ? "En Android TV, permite instalar apps desconocidas en Ajustes › Seguridad"
                : "En Ajustes de Android, permite instalar de orígenes desconocidos",
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
      </div>
    </div>
  );
}
