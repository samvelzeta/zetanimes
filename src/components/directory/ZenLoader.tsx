// Rayo minimalista — firma de carga de ZetAnime.
export default function ZenLoader({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg" className="zen-bolt" aria-hidden>
        <path
          d="M13.5 2 L4 13.5 h6 L9 22 l10.5-11.5 h-6 L15 2 Z"
          fill="currentColor"
          stroke="currentColor"
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
