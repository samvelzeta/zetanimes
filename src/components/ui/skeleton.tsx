import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Si true, muestra un rayo gris parpadeante centrado (estilo ZetAnime). */
  bolt?: boolean;
}

function Skeleton({ className, bolt = false, children, ...props }: SkeletonProps) {
  return (
    <div className={cn("relative animate-pulse rounded-md bg-muted overflow-hidden", className)} {...props}>
      {bolt && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-1/2 h-1/2 max-w-[64px] max-h-[64px] opacity-40 animate-[zet-bolt-pulse_1.8s_ease-in-out_infinite]"
            fill="currentColor"
            style={{ color: "hsl(var(--muted-foreground))" }}
            aria-hidden
          >
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
        </div>
      )}
      {children}
    </div>
  );
}

export { Skeleton };
