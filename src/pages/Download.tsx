import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Share2, Smartphone, Tv, Zap, Gauge, ArrowLeft, Check, Volume2, VolumeX, Copy, ExternalLink, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isTV } from "@/hooks/useIsTV";
import { isWebView } from "@/lib/webview";
import logoUrl from "@/assets/zetanime-apk-logo.png";

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
  const [version, setVersion] = useState("1.0.0");
  const [hasApk, setHasApk] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [audioOn, setAudioOn] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

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

    let active = true;

    supabase.functions.invoke("apk-resolve")
      .then(({ data, error }) => {
        if (!active) return;
        if (error || !data) {
          setHasApk(false);
          return;
        }

        const payload = data as Record<string, string> & { version?: string; ok?: boolean };
        const realUrl = reassemble(payload);
        setHasApk(Boolean(realUrl));
        if (payload.version) setVersion(payload.version);
      })
      .catch(() => {
        if (!active) return;
        setHasApk(false);
      });

    return () => {
      active = false;
    };
  }, []);

  // Reconstruye la URL real a partir de los fragmentos opacos devueltos por
  // la edge function. Los nombres de campo no insinúan "url" ni el origen.
  const reassemble = (fragments: Record<string, string>): string => {
    const n = Number(fragments?._n || 0);
    if (!n) return "";
    const order = ["p", "q", "r", "s", "t", "u"];
    let acc = "";
    for (let i = 0; i < n; i++) {
      const piece = fragments[order[i]];
      if (!piece) continue;
      try {
        acc += decodeURIComponent(escape(atob(piece)));
      } catch {
        return "";
      }
    }
    return acc;
  };

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const { data, error } = await supabase.functions.invoke("apk-resolve");
      if (error || !data) throw new Error(error?.message || "No se pudo preparar la descarga");
      const realUrl = reassemble(data as Record<string, string>);
      if (!realUrl) throw new Error("Enlace no disponible");

      setHasApk(true);
      const a = document.createElement("a");
      a.href = realUrl;
      a.rel = "noopener";
      a.download = "zetanime.apk";
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast.success("Iniciando descarga…");
    } catch (e: any) {
      setHasApk(false);
      toast.error(e?.message || "No se pudo iniciar la descarga");
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let removed = false;
    let audioAchieved = false;

    // Autoplay con sonido: el video SIEMPRE intenta sonar. Nunca arranca muteado.
    const ensureAudio = async (): Promise<boolean> => {
      if (audioAchieved || removed) return audioAchieved;
      const v = videoRef.current;
      if (!v) return false;
      try {
        v.muted = false;
        v.volume = 1;
        await v.play();
        if (!v.muted) {
          audioAchieved = true;
          setAudioOn(true);
          return true;
        }
      } catch {}
      return false;
    };

    const tryPlayWithSound = () => {
      setVideoReady(true);
      void ensureAudio();
    };

    // El navegador puede bloquear el sonido inicial; en cuanto el usuario haga
    // CUALQUIER gesto (toque, click, tecla, scroll), activamos el audio.
    const onUserGesture = () => {
      void ensureAudio();
    };

    // Intento inmediato con sonido apenas carga la página (sin esperar eventos).
    void ensureAudio();

    const readyEvents = ["loadeddata", "canplay", "canplaythrough"] as const;
    readyEvents.forEach((ev) => video.addEventListener(ev, tryPlayWithSound));
    const gestureEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "pointermove",
      "keydown",
      "touchstart",
      "scroll",
      "wheel",
    ];
    gestureEvents.forEach((ev) =>
      window.addEventListener(ev, onUserGesture, { passive: true })
    );

    if (video.readyState >= 2) tryPlayWithSound();

    return () => {
      removed = true;
      readyEvents.forEach((ev) => video.removeEventListener(ev, tryPlayWithSound));
      gestureEvents.forEach((ev) =>
        window.removeEventListener(ev, onUserGesture)
      );
    };
  }, []);

  const toggleAudio = async () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted) {
      try {
        v.muted = false;
        v.volume = 1;
        await v.play();
        setAudioOn(true);
      } catch {
        toast.error("Toca de nuevo para activar el audio");
      }
    } else {
      v.muted = true;
      setAudioOn(false);
    }
  };

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/download` : "";
  const shareText = "🔥 Ven a vivir una nueva experiencia con zetAnime — anime sub y latino sin límites, gratis en tu Android y Android TV.";
  const shareMessage = `${shareText}\n\n👉 Descarga la app aquí: ${shareUrl}`;
  
  // Debug: log actual domain being used
  useEffect(() => {
    if (typeof window !== "undefined") {
      console.log("[Download] Share URL:", `${window.location.origin}/download`);
    }
  }, []);
  const isMobileDevice =
    typeof window !== "undefined" &&
    (isWebView() || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""));

  const nativeShare = async () => {
    if (!navigator.share) return false;
    try {
      await navigator.share({
        title: "zetAnime — Anime sin límites",
        text: shareText,
        url: shareUrl,
      });
      return true;
    } catch (err: any) {
      // El usuario canceló: no mostramos error
      if (err?.name === "AbortError") return true;
      return false;
    }
  };

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      toast.success("Mensaje copiado con el enlace");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  };

  const handleShareClick = async () => {
    // Móvil/APK: intenta abrir el sistema nativo de compartir.
    // Si el WebView del APK no expone navigator.share, mostramos el panel
    // con WhatsApp/Copiar/Abrir como fallback (en vez de fallar en silencio).
    if (isMobileDevice && typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const ok = await nativeShare();
      if (ok) return;
      // Si falló (no AbortError), caemos al panel manual
    }
    // PC o WebView sin share API: panel con WhatsApp + copiar + abrir
    setShareOpen((s) => !s);
  };

  const openWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const openInNewTab = () => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
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
          autoPlay
          autoPlay
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

      {videoReady && (
        <button
          onClick={toggleAudio}
          className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-border bg-secondary/80 px-4 py-2 text-xs font-bold text-foreground backdrop-blur-sm"
        >
          {audioOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-primary" />}
          {audioOn ? "Desactivar sonido" : "Activar sonido"}
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
            <span className="text-[10px] font-bold text-primary">{deviceLabel}</span>
          </div>

          {/* Download button */}
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || !hasApk}
            className="mt-8 group relative w-full max-w-xs disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <div
              className="absolute inset-0 rounded-2xl blur-xl opacity-70 group-hover:opacity-100 transition"
              style={{ background: "hsl(var(--primary))" }}
            />
            <div className="relative flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-primary text-primary-foreground font-black text-base shadow-2xl hover:scale-[1.02] active:scale-95 transition">
              <Download className="w-5 h-5" />
              {downloading ? "Preparando…" : hasApk ? "Descargar APK" : "APK no disponible"}
            </div>
          </button>

          {/* Share controls */}
          <button
            onClick={handleShareClick}
            className="mt-3 w-full max-w-xs flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-secondary/70 backdrop-blur-sm border border-border text-foreground text-sm font-bold hover:bg-muted transition"
          >
            <Share2 className="w-4 h-4" /> Compartir aplicación
          </button>

          {shareOpen && (
            <div className="mt-3 w-full max-w-xs grid grid-cols-3 gap-2 animate-fade-in">
              <button
                onClick={openWhatsApp}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-secondary/80 border border-border hover:bg-muted transition"
              >
                <MessageCircle className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-bold text-foreground">WhatsApp</span>
              </button>
              <button
                onClick={copyShareLink}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-secondary/80 border border-border hover:bg-muted transition"
              >
                {copied ? <Check className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5 text-primary" />}
                <span className="text-[10px] font-bold text-foreground">{copied ? "Copiado" : "Copiar enlace"}</span>
              </button>
              <button
                onClick={openInNewTab}
                className="flex flex-col items-center gap-1 py-3 rounded-xl bg-secondary/80 border border-border hover:bg-muted transition"
              >
                <ExternalLink className="w-5 h-5 text-primary" />
                <span className="text-[10px] font-bold text-foreground">Abrir</span>
              </button>
            </div>
          )}
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
