import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onComplete: () => void;
  ready?: boolean; // si está definido, espera a que sea true antes de cerrar
}

export default function SplashScreen({ onComplete, ready }: Props) {
  const [show, setShow] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  // Mínimo 1.2s para que se vea la animación, máximo 5s aunque las queries no respondan
  useEffect(() => {
    const minT = setTimeout(() => setMinTimeElapsed(true), 1200);
    const maxT = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 5000);
    return () => { clearTimeout(minT); clearTimeout(maxT); };
  }, [onComplete]);

  // Cerrar cuando ya terminó tiempo mínimo Y las queries están listas
  useEffect(() => {
    // Si no se pasa "ready", funciona como antes (timer 2.2s)
    if (ready === undefined) {
      const t = setTimeout(() => {
        setShow(false);
        setTimeout(onComplete, 500);
      }, 2200);
      return () => clearTimeout(t);
    }
    if (minTimeElapsed && ready && show) {
      setShow(false);
      setTimeout(onComplete, 500);
    }
  }, [ready, minTimeElapsed, show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, hsl(16 100% 8%) 0%, hsl(0 0% 3%) 70%)" }}
        >
          {Array(8).fill(0).map((_, i) => (
            <motion.div key={i} className="absolute w-1 h-1 rounded-full bg-primary/60"
              initial={{ x: Math.random() * 600 - 300, y: Math.random() * 600 - 300, opacity: 0 }}
              animate={{ y: [0, -40, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 3 + Math.random() * 2, repeat: Infinity, delay: Math.random() * 2 }}
              style={{ left: `${15 + Math.random() * 70}%`, top: `${15 + Math.random() * 70}%` }}
            />
          ))}
          <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.2 }} className="relative mb-6">
            <div className="w-20 h-20 rounded-full border-2 border-primary/40 flex items-center justify-center" style={{ boxShadow: "0 0 40px hsl(16 100% 50% / 0.3)" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" className="text-primary">
                <path d="M13 2L4 14h6l-1 8 9-12h-6l1-8z" fill="currentColor" stroke="currentColor" strokeWidth="0.5" />
              </svg>
            </div>
            <motion.div className="absolute inset-0 rounded-full border border-primary/20" animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }} className="text-center">
            <h1 className="text-3xl font-black tracking-tight">
              <span className="text-foreground">zet</span>
              <span className="text-primary">Anime</span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1 tracking-[0.3em]">アニメゾーン</p>
            {ready === false && (
              <p className="text-[10px] text-primary/70 mt-3 animate-pulse">Cargando contenido…</p>
            )}
          </motion.div>
          {/* Barra de progreso indeterminada que va y vuelve */}
          <motion.div className="absolute bottom-20 w-32 h-1 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              animate={{ x: ["-100%", "100%"] }}
              transition={{ duration: 1.2, ease: "easeInOut", repeat: Infinity }}
              style={{ width: "60%" }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
