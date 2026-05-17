import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Save, Image as ImageIcon, CreditCard, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  listPremiumPlans,
  getPremiumSettings,
  savePremiumSettings,
  upsertPlan,
  deletePlan,
  uploadPremiumAsset,
  type PremiumPlan,
  type PremiumSettings,
} from "@/lib/premium-config";

const blankPlan = (): Partial<PremiumPlan> => ({
  name: "Nuevo plan",
  price_label: "$0",
  period: "yearly",
  membership_type: "annual",
  features: [],
  badge: null,
  accent_color: null,
  sort_order: 99,
  enabled: true,
});

export default function PremiumConfigEditor() {
  const [plans, setPlans] = useState<PremiumPlan[]>([]);
  const [settings, setSettings] = useState<PremiumSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploading, setUploading] = useState<"character" | "background" | null>(null);

  useEffect(() => { reload(); }, []);

  const reload = async () => {
    setLoading(true);
    const [p, s] = await Promise.all([listPremiumPlans(true), getPremiumSettings()]);
    setPlans(p);
    setSettings(s);
    setLoading(false);
  };

  const handleSettings = (patch: Partial<PremiumSettings>) => {
    setSettings((cur) => ({ ...(cur as any), ...patch }));
  };

  const persistSettings = async () => {
    if (!settings) return;
    setSavingSettings(true);
    const { id, ...rest } = settings;
    await savePremiumSettings(rest);
    setSavingSettings(false);
    toast.success("Configuración guardada");
  };

  const uploadAsset = async (e: React.ChangeEvent<HTMLInputElement>, kind: "character" | "background" | "checkout") => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(kind as any);
    try {
      const url = await uploadPremiumAsset(file, kind === "checkout" ? "character" : kind);
      const patch =
        kind === "character" ? { character_image_url: url } :
        kind === "background" ? { background_image_url: url } :
        { checkout_character_image_url: url };
      handleSettings(patch as any);
      await savePremiumSettings(patch as any);
      toast.success("Imagen subida");
    } catch {
      toast.error("Error al subir");
    } finally {
      setUploading(null);
    }
  };

  const removeAsset = async (kind: "character" | "background" | "checkout") => {
    const patch =
      kind === "character" ? { character_image_url: null } :
      kind === "background" ? { background_image_url: null } :
      { checkout_character_image_url: null };
    handleSettings(patch as any);
    await savePremiumSettings(patch as any);
  };

  const updatePlan = (id: string, patch: Partial<PremiumPlan>) => {
    setPlans((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const savePlan = async (plan: PremiumPlan) => {
    await upsertPlan(plan);
    toast.success(`Plan "${plan.name}" guardado`);
  };

  const addPlan = async () => {
    await upsertPlan(blankPlan());
    reload();
  };

  const removePlan = async (id: string) => {
    if (!confirm("¿Eliminar este plan?")) return;
    await deletePlan(id);
    reload();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8">
      {/* === SECCIÓN 1: Configuración del modal === */}
      <section className="space-y-3">
        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
          <ImageIcon className="w-4 h-4 text-primary" /> Modal premium · Personalización
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Título principal">
            <Input value={settings?.title || ""} onChange={(e) => handleSettings({ title: e.target.value })} />
          </Field>
          <Field label="Subtítulo (frase grande)">
            <Input value={settings?.subtitle || ""} onChange={(e) => handleSettings({ subtitle: e.target.value })} />
          </Field>
        </div>

        <Field label="Descripción">
          <textarea
            value={settings?.description || ""}
            onChange={(e) => handleSettings({ description: e.target.value })}
            className="w-full h-20 bg-secondary border border-border rounded-xl p-3 text-sm resize-none"
          />
        </Field>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AssetUpload
            label="Imagen del personaje (transparente, lateral del modal)"
            url={settings?.character_image_url}
            uploading={uploading === "character"}
            onUpload={(e) => uploadAsset(e, "character")}
            onRemove={() => removeAsset("character")}
          />
          <AssetUpload
            label="Imagen de fondo (opcional, decorativa)"
            url={settings?.background_image_url}
            uploading={uploading === "background"}
            onUpload={(e) => uploadAsset(e, "background")}
            onRemove={() => removeAsset("background")}
          />
        </div>

        <Field label="Modo de layout">
          <select
            value={settings?.layout_mode || "lateral"}
            onChange={(e) => handleSettings({ layout_mode: e.target.value as any })}
            className="w-full h-10 bg-secondary border border-border rounded-xl px-3 text-sm"
          >
            <option value="lateral">Lateral derecho (PC) / arriba (móvil)</option>
            <option value="background">Fondo decorativo translúcido</option>
          </select>
        </Field>

        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={settings?.show_proof_form !== false}
            onChange={(e) => handleSettings({ show_proof_form: e.target.checked })}
          />
          Mostrar formulario de comprobante (transferencia bancaria)
        </label>
      </section>

      {/* === SECCIÓN 2: Pasarelas === */}
      <section className="space-y-3 pt-4 border-t border-border">
        <h3 className="text-sm font-black text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-primary" /> Pasarelas de pago online
        </h3>
        <label className="flex items-center gap-2 text-xs text-foreground">
          <input
            type="checkbox"
            checked={!!settings?.stripe_enabled}
            onChange={(e) => handleSettings({ stripe_enabled: e.target.checked })}
          />
          Activar botón de Stripe
        </label>
        <Field label="URL de Stripe Checkout (Payment Link)">
          <Input
            value={settings?.stripe_payment_url || ""}
            onChange={(e) => handleSettings({ stripe_payment_url: e.target.value })}
            placeholder="https://buy.stripe.com/..."
          />
        </Field>
        <Field label="URL alterna (PayPal / Mercado Pago / etc.)">
          <Input
            value={settings?.alt_payment_url || ""}
            onChange={(e) => handleSettings({ alt_payment_url: e.target.value })}
            placeholder="https://..."
          />
        </Field>

        <button
          onClick={persistSettings}
          disabled={savingSettings}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
          {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar configuración
        </button>
      </section>

      {/* === SECCIÓN 3: Planes CRUD === */}
      <section className="space-y-3 pt-4 border-t border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-foreground">Planes ({plans.length})</h3>
          <button onClick={addPlan} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-black flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Añadir plan
          </button>
        </div>

        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onChange={(patch) => updatePlan(plan.id, patch)}
              onSave={() => savePlan(plan)}
              onDelete={() => removePlan(plan.id)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-primary mb-1 block font-black uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function AssetUpload({ label, url, uploading, onUpload, onRemove }: any) {
  return (
    <div>
      <label className="text-[10px] text-primary mb-1 block font-black uppercase tracking-wider">{label}</label>
      <div className="rounded-xl border-2 border-dashed border-border p-3 bg-secondary/40">
        {url ? (
          <div className="relative">
            <img src={url} alt="" className="w-full h-32 object-contain rounded" />
            <button onClick={onRemove} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">Sin imagen</div>
        )}
        <label className="mt-2 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-background border border-border hover:border-primary cursor-pointer text-xs">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? "Subiendo..." : "Subir imagen"}
          <input type="file" accept="image/*" onChange={onUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
    </div>
  );
}

function PlanCard({ plan, onChange, onSave, onDelete }: { plan: PremiumPlan; onChange: (p: Partial<PremiumPlan>) => void; onSave: () => void; onDelete: () => void; }) {
  const featuresText = plan.features.join("\n");
  return (
    <div className="rounded-xl border-2 border-border p-4 bg-card space-y-2.5">
      <div className="flex items-center gap-2">
        <Input value={plan.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Nombre" className="h-9 flex-1" />
        <Input value={plan.price_label} onChange={(e) => onChange({ price_label: e.target.value })} placeholder="Precio" className="h-9 w-32" />
        <button onClick={onDelete} className="p-2 rounded-lg text-destructive hover:bg-destructive/10">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <select value={plan.period} onChange={(e) => onChange({ period: e.target.value })} className="h-9 bg-secondary border border-border rounded-lg px-2 text-xs">
          <option value="monthly">Mensual</option>
          <option value="yearly">Anual</option>
          <option value="lifetime">Único</option>
          <option value="custom">Personalizado</option>
        </select>
        <select value={plan.membership_type} onChange={(e) => onChange({ membership_type: e.target.value as any })} className="h-9 bg-secondary border border-border rounded-lg px-2 text-xs">
          <option value="annual">Renovable (anual)</option>
          <option value="lifetime">Para siempre</option>
        </select>
        <Input value={plan.badge || ""} onChange={(e) => onChange({ badge: e.target.value || null })} placeholder="Badge (ej: Popular)" className="h-9" />
        <Input value={plan.accent_color || ""} onChange={(e) => onChange({ accent_color: e.target.value || null })} placeholder="Color #hex/hsl" className="h-9" />
      </div>

      <div>
        <label className="text-[10px] text-muted-foreground">Beneficios (uno por línea)</label>
        <textarea
          value={featuresText}
          onChange={(e) => onChange({ features: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          className="w-full h-24 bg-secondary border border-border rounded-lg p-2 text-xs resize-none"
        />
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={plan.enabled} onChange={(e) => onChange({ enabled: e.target.checked })} />
          Visible en el modal
        </label>
        <Input
          type="number"
          value={plan.sort_order}
          onChange={(e) => onChange({ sort_order: parseInt(e.target.value || "0") })}
          className="h-8 w-20 text-xs"
          placeholder="Orden"
        />
        <button onClick={onSave} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-black flex items-center gap-1.5">
          <Save className="w-3.5 h-3.5" /> Guardar
        </button>
      </div>
    </div>
  );
}
