// Capas de engranajes giratorios para fondo global steampunk
// Se desactivan automáticamente en modo TV (ver useIsTV) y con prefers-reduced-motion (CSS)
import { useIsTV } from "@/hooks/useIsTV";

const Gear = ({ teeth = 12 }: { teeth?: number }) => (
  <svg viewBox="0 0 100 100" className="w-full h-full" fill="none" stroke="currentColor" strokeWidth="0.6">
    <g transform="translate(50 50)">
      {Array.from({ length: teeth }).map((_, i) => (
        <rect key={i} x="-4" y="-48" width="8" height="10" transform={`rotate(${(360 / teeth) * i})`} />
      ))}
      <circle r="38" />
      <circle r="28" />
      <circle r="8" />
      {Array.from({ length: 6 }).map((_, i) => (
        <line key={i} x1="0" y1="-26" x2="0" y2="-12" transform={`rotate(${i * 60})`} />
      ))}
    </g>
  </svg>
);

export default function SteamGears() {
  const isTV = useIsTV();
  if (isTV) return null; // sin engranajes en TV para ahorrar GPU

  return (
    <>
      <div className="gear-layer gear-1" aria-hidden><Gear teeth={12} /></div>
      <div className="gear-layer gear-2" aria-hidden><Gear teeth={10} /></div>
      <div className="gear-layer gear-3" aria-hidden><Gear teeth={8} /></div>
    </>
  );
}
