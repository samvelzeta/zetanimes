import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  onComplete: () => void;
  ready?: boolean;
}

export default function SplashScreen({ onComplete, ready }: Props) {
  const [show, setShow] = useState(true);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);

  useEffect(() => {
    const minT = setTimeout(() => setMinTimeElapsed(true), 1400);
    const maxT = setTimeout(() => {
      setShow(false);
      setTimeout(onComplete, 500);
    }, 5000);
    return () => { clearTimeout(minT); clearTimeout(maxT); };
  }, [onComplete]);

  useEffect(() => {
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
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at center, hsl(20 60% 12%) 0%, hsl(20 30% 6%) 50%, hsl(0 0% 2%) 100%)",
          }}
        >
          {/* Chispas naranjas flotando */}
          {Array(12).fill(0).map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 rounded-full bg-primary"
              style={{
                left: `${10 + Math.random() * 80}%`,
                top: `${20 + Math.random() * 60}%`,
                boxShadow: "0 0 6px hsl(16 100% 55%), 0 0 12px hsl(16 100% 50% / 0.5)",
              }}
              animate={{
                y: [0, -50, 0],
                opacity: [0, 1, 0],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 2.5 + Math.random() * 1.5,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}

          {/* Engranaje grande de fondo (girando lento) */}
          <motion.svg
            width="280"
            height="280"
            viewBox="0 0 100 100"
            className="absolute opacity-15"
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          >
            <defs>
              <radialGradient id="gearGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(20 40% 20%)" />
                <stop offset="100%" stopColor="hsl(20 30% 8%)" />
              </radialGradient>
            </defs>
            <g transform="translate(50 50)">
              {Array.from({ length: 12 }).map((_, i) => (
                <rect
                  key={i}
                  x="-4"
                  y="-48"
                  width="8"
                  height="10"
                  fill="url(#gearGrad)"
                  stroke="hsl(20 50% 25%)"
                  strokeWidth="0.5"
                  transform={`rotate(${i * 30})`}
                />
              ))}
              <circle r="38" fill="url(#gearGrad)" stroke="hsl(20 50% 25%)" strokeWidth="1" />
              <circle r="28" fill="none" stroke="hsl(20 60% 30%)" strokeWidth="0.8" />
            </g>
          </motion.svg>

          {/* Logo central: engranaje pequeño girando + rayo fijo */}
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.2 }}
            className="relative mb-8"
            style={{ filter: "drop-shadow(0 0 30px hsl(16 100% 50% / 0.4))" }}
          >
            {/* Engranaje del logo */}
            <motion.svg
              width="140"
              height="140"
              viewBox="0 0 100 100"
              animate={{ rotate: 360 }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
            >
              <defs>
                <radialGradient id="logoGearGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="hsl(22 55% 28%)" />
                  <stop offset="70%" stopColor="hsl(20 50% 18%)" />
                  <stop offset="100%" stopColor="hsl(18 40% 10%)" />
                </radialGradient>
                <linearGradient id="bevelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="hsl(25 60% 40%)" />
                  <stop offset="100%" stopColor="hsl(18 30% 8%)" />
                </linearGradient>
              </defs>
              <g transform="translate(50 50)">
                {/* Dientes del engranaje */}
                {Array.from({ length: 12 }).map((_, i) => (
                  <g key={i} transform={`rotate(${i * 30})`}>
                    <polygon
                      points="-5,-46 5,-46 4,-38 -4,-38"
                      fill="url(#bevelGrad)"
                      stroke="hsl(20 60% 35%)"
                      strokeWidth="0.4"
                    />
                  </g>
                ))}
                {/* Cuerpo del engranaje */}
                <circle r="38" fill="url(#logoGearGrad)" stroke="hsl(22 70% 40%)" strokeWidth="1.2" />
                {/* Anillo interior */}
                <circle r="30" fill="none" stroke="hsl(22 60% 32%)" strokeWidth="0.8" />
                {/* Marcas decorativas (como el logo) */}
                {Array.from({ length: 8 }).map((_, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1="-32"
                    x2="0"
                    y2="-26"
                    stroke="hsl(22 50% 25%)"
                    strokeWidth="1"
                    transform={`rotate(${i * 45})`}
                  />
                ))}
                {/* Centro */}
                <circle r="20" fill="hsl(20 45% 15%)" stroke="hsl(22 55% 28%)" strokeWidth="0.8" />
              </g>
            </motion.svg>

            {/* Rayo central FIJO (no gira con el engranaje) */}
            <div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              style={{ filter: "drop-shadow(0 0 8px hsl(16 100% 55%)) drop-shadow(0 0 16px hsl(16 100% 50%))" }}
            >
              <motion.svg
                width="44"
                height="44"
                viewBox="0 0 24 24"
                animate={{
                  filter: [
                    "brightness(1)",
                    "brightness(1.3)",
                    "brightness(1)",
                  ],
                }}
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                <defs>
                  <linearGradient id="boltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(45 100% 70%)" />
                    <stop offset="50%" stopColor="hsl(20 100% 55%)" />
                    <stop offset="100%" stopColor="hsl(10 100% 45%)" />
                  </linearGradient>
                </defs>
                <path
                  d="M13 2L4 14h6l-1 8 9-12h-6l1-8z"
                  fill="url(#boltGrad)"
                  stroke="hsl(40 100% 75%)"
                  strokeWidth="0.4"
                  strokeLinejoin="round"
                />
              </motion.svg>
            </div>

            {/* Anillo de pulso */}
            <motion.div
              className="absolute inset-0 rounded-full border-2 pointer-events-none"
              style={{ borderColor: "hsl(16 100% 50% / 0.4)" }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          </motion.div>

          {/* Texto */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl tracking-wider" style={{ fontFamily: '"Cinzel", serif', fontWeight: 700 }}>
              <span className="text-foreground">zet</span>
              <span className="text-primary">Anime</span>
            </h1>
            <p className="text-[10px] text-muted-foreground mt-2 tracking-[0.5em] uppercase">
              アニメゾーン
            </p>
            {ready === false && (
              <p className="text-[10px] text-primary/80 mt-3 animate-pulse tracking-widest uppercase">
                Engranando contenido…
              </p>
            )}
          </motion.div>

          {/* Barra de progreso steampunk */}
          <div
            className="absolute bottom-20 w-44 h-1.5 rounded-full overflow-hidden"
            style={{
              background: "hsl(20 30% 10%)",
              border: "1px solid hsl(22 50% 22%)",
              boxShadow: "inset 0 1px 2px hsl(0 0% 0% / 0.6)",
            }}
          >
            <motion.div
              className="h-full"
              style={{
                background: "linear-gradient(90deg, hsl(45 100% 60%), hsl(16 100% 55%), hsl(45 100% 60%))",
                width: "50%",
                boxShadow: "0 0 8px hsl(16 100% 50%)",
              }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.4, ease: "easeInOut", repeat: Infinity }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
