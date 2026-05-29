import { supabase } from "@/integrations/supabase/client";

export type PremiumPlanSlug = "basico" | "solo" | "duo";
export type QualityMax = "hd" | "fhd" | "4k";

export interface PremiumPlanConfig {
  slug: PremiumPlanSlug;
  name: string;
  price_label: string;
  badge: string | null;
  accent_color: string;
  sort_order: number;
  enabled: boolean;
  ads_free: boolean;
  show_ads_free: boolean;
  quality_enabled: boolean;
  quality_max: QualityMax;
  quality_label: string;
  show_quality: boolean;
  streams_enabled: boolean;
  max_streams: number;
  show_streams: boolean;
  profiles_enabled: boolean;
  max_profiles: number;
  show_profiles: boolean;
  pdf_export: boolean;
  show_pdf_export: boolean;
  downloads_allowed: boolean;
  show_downloads: boolean;
  priority_support: boolean;
  show_priority_support: boolean;
  vip_support: boolean;
  show_vip_support: boolean;
  priority_servers: boolean;
  show_priority_servers: boolean;
  multi_status_selection: boolean;
  custom_avatar_upload: boolean;
  inherited_from: PremiumPlanSlug | null;
  updated_at?: string;
}

export interface PremiumPlan extends PremiumPlanConfig {
  features: string[];
}

export interface PremiumSettings {
  id: string;
  title?: string;
  subtitle?: string;
}

export const PLAN_ORDER: PremiumPlanSlug[] = ["basico", "solo", "duo"];

export function planLabel(slug: string | null | undefined): string {
  if (slug === "duo") return "Dúo";
  if (slug === "solo") return "Solo";
  if (slug === "basico") return "Básico";
  if (slug === "owner") return "Owner";
  return "Gratis";
}

export function planPriority(slug: string | null | undefined): number {
  if (slug === "owner") return 4;
  if (slug === "duo") return 3;
  if (slug === "solo") return 2;
  if (slug === "basico") return 1;
  return 0;
}

export function buildPlanFeatures(plan: PremiumPlanConfig): string[] {
  const features: string[] = [];
  if (plan.inherited_from) features.push(`Todo lo del ${planLabel(plan.inherited_from)}`);
  if (plan.ads_free && plan.show_ads_free) features.push("Sin anuncios");
  if (plan.quality_enabled && plan.show_quality) features.push(plan.quality_label || "Calidad HD");
  if (plan.streams_enabled && plan.show_streams) features.push(`${plan.max_streams} dispositivo${plan.max_streams === 1 ? "" : "s"} simultáneo${plan.max_streams === 1 ? "" : "s"}`);
  if (plan.profiles_enabled && plan.show_profiles) features.push(`${plan.max_profiles} perfiles por cuenta`);
  if (plan.priority_servers && plan.show_priority_servers) features.push("Servidores prioritarios");
  if (plan.priority_support && plan.show_priority_support) features.push("Soporte rápido para animes caídos");
  if (plan.pdf_export && plan.show_pdf_export) features.push("Descargas y export PDF");
  if (plan.downloads_allowed && plan.show_downloads) features.push("Descargas habilitadas");
  if (plan.vip_support && plan.show_vip_support) features.push("Soporte VIP prioritario");
  return features;
}

export async function listPremiumPlans(includeDisabled = false): Promise<PremiumPlan[]> {
  let query = supabase
    .from("premium_plan_configs" as any)
    .select("*")
    .order("sort_order", { ascending: true });
  if (!includeDisabled) query = query.eq("enabled", true);
  const { data, error } = await query;
  if (error) throw error;
  return (((data as unknown) as PremiumPlanConfig[]) || []).map((plan) => ({ ...plan, features: buildPlanFeatures(plan) }));
}

export async function savePremiumPlan(plan: PremiumPlanConfig): Promise<void> {
  const { features: _features, updated_at: _updatedAt, ...payload } = plan as PremiumPlan;
  const { error } = await supabase
    .from("premium_plan_configs" as any)
    .update(payload as any)
    .eq("slug", plan.slug);
  if (error) throw error;
}

export async function getPremiumSettings(): Promise<PremiumSettings | null> { return null; }
export async function savePremiumSettings(): Promise<void> {}
export async function upsertPlan(plan?: PremiumPlanConfig): Promise<void> { if (plan) await savePremiumPlan(plan); }
export async function deletePlan(): Promise<void> {}
export async function uploadPremiumAsset(): Promise<string> { return ""; }
