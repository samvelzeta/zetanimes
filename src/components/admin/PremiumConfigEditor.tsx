// [REEMPLAZADO] El editor de planes premium se eliminó.
// Los 3 planes (Básico/Solo/Dúo) ahora son fijos en código y se pagan vía Ko-fi.
// La activación es automática vía webhook de Make.com → edge function `kofi-webhook`.
import { Crown, ExternalLink } from "lucide-react";

export default function PremiumConfigEditor() {
  return (
    <div className="rounded-xl border border-border bg-secondary/60 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Crown className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-bold text-foreground">Sistema premium</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        El sistema premium ahora es 100 % automático. Los tres planes (Básico $5, Solo $8, Dúo $10)
        son fijos y se cobran vía Ko-fi. Make.com recibe el webhook de Ko-fi y llama a la edge
        function <code className="px-1 py-0.5 rounded bg-background text-primary">kofi-webhook</code>
        que actualiza <code className="px-1 py-0.5 rounded bg-background text-primary">profiles.subscription_status</code>.
      </p>
      <a
        href="https://ko-fi.com/zetanimes"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
      >
        Abrir Ko-fi <ExternalLink className="w-3 h-3" />
      </a>
    </div>
  );
}
