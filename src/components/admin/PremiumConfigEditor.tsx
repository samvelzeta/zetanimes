import { useEffect, useState, type ReactNode } from "react";
import { Crown, ExternalLink, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { listPremiumPlans, savePremiumPlan, type PremiumPlanConfig } from "@/lib/premium-config";

type BoolKey = keyof Pick<PremiumPlanConfig,
  "enabled" | "ads_free" | "quality_enabled" | "streams_enabled" | "profiles_enabled" |
  "pdf_export" | "downloads_allowed" | "priority_support" | "vip_support" |
  "priority_servers" | "multi_status_selection" | "custom_avatar_upload" |
  "uninterrupted_fullscreen"
>;

const FEATURE_SWITCHES: { key: BoolKey; label: string; helper: string }[] = [
  { key: "enabled", label: "Mostrar plan", helper: "Aparece en Obtener Premium y puede activar permisos." },
  { key: "ads_free", label: "Sin anuncios", helper: "Oculta anuncios y el bloqueo por adblock." },
  { key: "quality_enabled", label: "Calidad incluida", helper: "Aplica la calidad máxima elegida." },
  { key: "streams_enabled", label: "Sesiones simultáneas", helper: "Aplica el límite de reproducciones/dispositivos." },
  { key: "profiles_enabled", label: "Perfiles por cuenta", helper: "Aplica el máximo real de perfiles." },
  { key: "pdf_export", label: "Exportación PDF", helper: "Desbloquea exportar historial/listas." },
  { key: "downloads_allowed", label: "Descargas", helper: "Permiso interno para descargas." },
  { key: "priority_support", label: "Soporte rápido", helper: "Marca reportes con prioridad de atención." },
  { key: "vip_support", label: "Soporte VIP", helper: "Prioridad máxima en reportes/tickets." },
  { key: "priority_servers", label: "Servidores prioritarios", helper: "Déjalo apagado si no lo ofreces." },
  { key: "multi_status_selection", label: "Multiestado en listas", helper: "Permite más estados simultáneos." },
  { key: "custom_avatar_upload", label: "Avatar propio", helper: "Permite subir foto desde el dispositivo." },
  { key: "uninterrupted_fullscreen", label: "Pantalla completa ininterrumpida", helper: "Al cambiar de episodio NO sale de pantalla completa y NO muestra anuncios." },
];

function syncVisibility(plan: PremiumPlanConfig, key: BoolKey, value: boolean): PremiumPlanConfig {
  const next: PremiumPlanConfig = { ...plan, [key]: value };
  const visibilityMap: Partial<Record<BoolKey, keyof PremiumPlanConfig>> = {
    ads_free: "show_ads_free",
    quality_enabled: "show_quality",
    streams_enabled: "show_streams",
    profiles_enabled: "show_profiles",
    pdf_export: "show_pdf_export",
    downloads_allowed: "show_downloads",
    priority_support: "show_priority_support",
    vip_support: "show_vip_support",
    priority_servers: "show_priority_servers",
  };
  const showKey = visibilityMap[key];
  if (showKey) (next as any)[showKey] = value;
  return next;
}

export default function PremiumConfigEditor() {
  const [plans, setPlans] = useState<PremiumPlanConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingSlug, setSavingSlug] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await listPremiumPlans(true);
      setPlans(data as PremiumPlanConfig[]);
    } catch (e: any) {
      toast.error(e.message || "No se pudieron cargar los planes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const patchPlan = (slug: string, patch: Partial<PremiumPlanConfig>) => {
    setPlans((cur) => cur.map((plan) => plan.slug === slug ? { ...plan, ...patch } : plan));
  };

  const toggleFeature = (slug: string, key: BoolKey, value: boolean) => {
    setPlans((cur) => cur.map((plan) => plan.slug === slug ? syncVisibility(plan, key, value) : plan));
  };

  const save = async (plan: PremiumPlanConfig) => {
    setSavingSlug(plan.slug);
    try {
      await savePremiumPlan(plan);
      toast.success(`${plan.name} guardado y aplicado`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    } finally {
      setSavingSlug(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-secondary/60 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Planes Premium editables</h3>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Lo que actives aquí se muestra en Obtener Premium y también se aplica como permiso real en la cuenta.
        </p>
        <a href="https://ko-fi.com/zetanimes" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
          Abrir Ko-fi <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {plans.map((plan) => (
        <div key={plan.slug} className="rounded-xl border border-border bg-secondary/50 p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-black text-foreground">{plan.name}</h4>
              <p className="text-[10px] text-muted-foreground uppercase">{plan.slug}</p>
            </div>
            <button onClick={() => save(plan)} disabled={savingSlug === plan.slug} className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5 disabled:opacity-50">
              {savingSlug === plan.slug ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Guardar
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="Nombre"><Input value={plan.name} onChange={(e) => patchPlan(plan.slug, { name: e.target.value })} className="h-9 bg-background border-border" /></Field>
            <Field label="Precio"><Input value={plan.price_label} onChange={(e) => patchPlan(plan.slug, { price_label: e.target.value })} className="h-9 bg-background border-border" /></Field>
            <Field label="Etiqueta"><Input value={plan.badge || ""} onChange={(e) => patchPlan(plan.slug, { badge: e.target.value || null })} placeholder="Popular" className="h-9 bg-background border-border" /></Field>
            <Field label="Color"><Input value={plan.accent_color} onChange={(e) => patchPlan(plan.slug, { accent_color: e.target.value })} className="h-9 bg-background border-border" /></Field>
            <Field label="Calidad visible"><Input value={plan.quality_label} onChange={(e) => patchPlan(plan.slug, { quality_label: e.target.value })} className="h-9 bg-background border-border" /></Field>
            <Field label="Calidad máxima funcional">
              <select value={plan.quality_max} onChange={(e) => patchPlan(plan.slug, { quality_max: e.target.value as any })} className="w-full h-9 bg-background border border-border rounded-md px-3 text-sm text-foreground">
                <option value="hd">HD</option>
                <option value="fhd">Full HD</option>
                <option value="4k">4K</option>
              </select>
            </Field>
            <Field label="Dispositivos/sesiones"><Input type="number" min={1} value={plan.max_streams} onChange={(e) => patchPlan(plan.slug, { max_streams: Math.max(1, Number(e.target.value) || 1) })} className="h-9 bg-background border-border" /></Field>
            <Field label="Perfiles por cuenta"><Input type="number" min={1} value={plan.max_profiles} onChange={(e) => patchPlan(plan.slug, { max_profiles: Math.max(1, Number(e.target.value) || 1) })} className="h-9 bg-background border-border" /></Field>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FEATURE_SWITCHES.map((item) => (
              <label key={item.key} className="flex items-start gap-2 rounded-lg border border-border bg-background/60 p-3 cursor-pointer hover:border-primary/50 transition">
                <input type="checkbox" checked={Boolean(plan[item.key])} onChange={(e) => toggleFeature(plan.slug, item.key, e.target.checked)} className="mt-0.5 accent-primary" />
                <span>
                  <span className="block text-xs font-bold text-foreground">{item.label}</span>
                  <span className="block text-[10px] text-muted-foreground leading-snug">{item.helper}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-[10px] font-bold text-primary uppercase">{label}</span>
      {children}
    </label>
  );
}
