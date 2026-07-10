import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import html2canvas from "html2canvas";
import { ChevronLeft, ChevronRight, Download, Lock, X, Share2, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { useWrapped } from "@/hooks/useWrapped";
import { useUserXP } from "@/hooks/useUserXP";

const SLIDE_BG = [
  "from-primary/40 via-background to-black",
  "from-fuchsia-600/40 via-background to-black",
  "from-amber-500/40 via-background to-black",
  "from-cyan-500/40 via-background to-black",
  "from-emerald-500/40 via-background to-black",
];

export default function Wrapped() {
  const { year: yearParam } = useParams();
  const nav = useNavigate();
  const year = Number(yearParam) || new Date().getFullYear();
  const { user } = useAuth();
  const { permissions } = usePlanPermissions();
  const { data, loading } = useWrapped(user?.id, year);
  const { xp } = useUserXP();
  const isPremium = permissions.slug !== "free";

  const [slide, setSlide] = useState(0);
  const slideRef = useRef<HTMLDivElement>(null);

  const total = 5;
  const maxSlide = isPremium ? total - 1 : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setSlide((s) => Math.min(maxSlide, s + 1));
      if (e.key === "ArrowLeft") setSlide((s) => Math.max(0, s - 1));
      if (e.key === "Escape") nav(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [maxSlide, nav]);

  const download = async () => {
    if (!slideRef.current || !isPremium) return;
    const canvas = await html2canvas(slideRef.current, { backgroundColor: "#000", scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = `zetanime-wrapped-${year}-slide${slide + 1}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const share = async () => {
    if (!navigator.share) return;
    await navigator.share({
      title: `Mi ZetAnime Wrapped ${year}`,
      text: `Vi ${data?.totalHours.toFixed(0)}h de anime en ${year} en ZetAnime 🔥`,
      url: window.location.href,
    }).catch(() => {});
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground">Inicia sesión para ver tu Wrapped.</p>
          <button onClick={() => nav("/auth")} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">Entrar</button>
        </div>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Zap className="w-12 h-12 text-primary fill-current animate-pulse" />
      </div>
    );
  }

  const slides = [
    <SlideStat key="0" big={`${Math.round(data.totalHours)}h`} title="Viste anime este año" sub={`En ${data.totalEpisodes} episodios · ${data.activeDays} días activos`} />,
    <SlideTop key="1" animes={data.topAnimes} />,
    <SlideStat key="2" big={data.uniqueAnimes.toString()} title="Animes distintos" sub={`Completaste ${data.completedEpisodes} episodios`} />,
    <SlideStat key="3" big={data.peakDay ? `${data.peakDay.hours.toFixed(1)}h` : "—"} title="Tu día más otaku" sub={data.peakDay ? new Date(data.peakDay.date).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" }) : "Sin datos"} />,
    <SlideStat key="4" big={xp?.rank_slug?.toUpperCase() || "GENIN"} title={`Nivel ${xp?.level || 1}`} sub={`${(xp?.xp || 0).toLocaleString()} XP acumulado`} />,
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Progress bars */}
      <div className="flex gap-1 p-3 pt-4">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full bg-white transition-all duration-500 ${i < slide ? "w-full" : i === slide ? "w-full" : "w-0"}`} />
          </div>
        ))}
      </div>

      <button onClick={() => nav(-1)} className="absolute top-3 right-3 z-30 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
        <X className="w-4 h-4 text-white" />
      </button>

      {/* Slide */}
      <div
        ref={slideRef}
        className={`relative flex-1 flex items-center justify-center bg-gradient-to-br ${SLIDE_BG[slide]} overflow-hidden`}
      >
        <div className="absolute top-4 left-5 text-[10px] font-mono uppercase tracking-[0.3em] text-white/50">
          ZetAnime · Wrapped {year}
        </div>
        <div className="absolute bottom-4 right-5 text-[10px] font-mono uppercase tracking-[0.3em] text-white/40">
          {slide + 1} / {total}
        </div>
        {slides[slide]}
      </div>

      {/* Locked overlay for free */}
      {!isPremium && slide === 0 && (
        <div className="p-4 bg-black border-t border-white/10 text-center space-y-2">
          <p className="text-xs text-white/60 flex items-center justify-center gap-1.5">
            <Lock className="w-3 h-3" /> Los otros 4 slides son exclusivos Premium
          </p>
          <button onClick={() => nav("/settings")} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
            Hacerte Premium
          </button>
        </div>
      )}

      {/* Nav controls */}
      {isPremium && (
        <>
          <button
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            disabled={slide === 0}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 disabled:opacity-30 flex items-center justify-center z-20 transition"
          >
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <button
            onClick={() => setSlide((s) => Math.min(maxSlide, s + 1))}
            disabled={slide === maxSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-black/40 hover:bg-black/70 disabled:opacity-30 flex items-center justify-center z-20 transition"
          >
            <ChevronRight className="w-6 h-6 text-white" />
          </button>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
            <button onClick={download} className="px-3 py-2 rounded-full bg-white text-black text-xs font-semibold flex items-center gap-1.5 hover:bg-white/90 transition">
              <Download className="w-3.5 h-3.5" /> Guardar PNG
            </button>
            {typeof navigator !== "undefined" && "share" in navigator && (
              <button onClick={share} className="px-3 py-2 rounded-full bg-white/10 backdrop-blur text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-white/20 transition">
                <Share2 className="w-3.5 h-3.5" /> Compartir
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function SlideStat({ big, title, sub }: { big: string; title: string; sub: string }) {
  return (
    <div className="text-center px-6 max-w-md">
      <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-3">{title}</p>
      <p className="text-6xl sm:text-8xl font-black text-white drop-shadow-[0_0_30px_hsl(var(--primary))] leading-none">
        {big}
      </p>
      <p className="mt-4 text-sm text-white/70">{sub}</p>
    </div>
  );
}

function SlideTop({ animes }: { animes: { id: number; title: string; cover: string | null; episodes: number }[] }) {
  return (
    <div className="w-full max-w-md px-6">
      <p className="text-xs uppercase tracking-[0.3em] text-white/50 mb-4 text-center">Tu top 5</p>
      <div className="space-y-2">
        {animes.length === 0 && <p className="text-white/50 text-sm text-center">Sin datos este año</p>}
        {animes.map((a, i) => (
          <div key={a.id} className="flex items-center gap-3 bg-white/5 backdrop-blur rounded-lg p-2 border border-white/10">
            <span className="text-2xl font-black text-primary w-8 text-center">{i + 1}</span>
            {a.cover && <img src={a.cover} alt="" className="w-10 h-14 rounded object-cover" loading="lazy" />}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{a.title}</p>
              <p className="text-[10px] text-white/50">{a.episodes} episodios</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
