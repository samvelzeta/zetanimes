// Mascota minimalista Zen/Zani — usada en skeletons de carga.
// SVG inline (sin dependencias) — un zorrito/gato estilizado con orejas puntiagudas.
export default function ZetMascot({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      {/* Orejas */}
      <path d="M10 8 L16 22 L22 14 Z" fill="currentColor" opacity="0.9" />
      <path d="M38 8 L32 22 L26 14 Z" fill="currentColor" opacity="0.9" />
      {/* Cara */}
      <ellipse cx="24" cy="26" rx="14" ry="13" fill="currentColor" opacity="0.85" />
      {/* Ojos */}
      <circle cx="19" cy="25" r="1.6" fill="hsl(var(--background))" />
      <circle cx="29" cy="25" r="1.6" fill="hsl(var(--background))" />
      {/* Naricita */}
      <path d="M23 30 L25 30 L24 31.5 Z" fill="hsl(var(--background))" />
    </svg>
  );
}
