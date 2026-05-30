// Sistema de permisos basado en columnas de `profiles`:
//   subscription_status ('active' | 'inactive' | 'expired')
//   plan_type ('basico' | 'solo' | 'duo')
// Activación vía Ko-fi + webhook Make.com → edge function `kofi-webhook`.
import { supabase } from "@/integrations/supabase/client";
import { type PremiumPlanConfig } from "@/lib/premium-config";

export interface PlanPermissions {
  slug: string;
  name: string;
  max_streams: number;
  max_profiles: number;
  quality_max: "hd" | "fhd" | "4k";
  ads_free: boolean;
  priority_servers: boolean;
  downloads_allowed: boolean;
  priority_support: boolean;
  pdf_export: boolean;
  premium_badge: boolean;
  multi_status_selection: boolean;
  custom_avatar_upload: boolean;
  vip_support: boolean;
  uninterrupted_fullscreen: boolean;
}

export const FREE_PERMISSIONS: PlanPermissions = {
  slug: "free",
  name: "Gratis",
  max_streams: 1,
  max_profiles: 1,
  quality_max: "hd",
  ads_free: false,
  priority_servers: false,
  downloads_allowed: false,
  priority_support: false,
  pdf_export: false,
  premium_badge: false,
  multi_status_selection: false,
  custom_avatar_upload: false,
  vip_support: false,
  uninterrupted_fullscreen: false,
};

export const OWNER_PERMISSIONS: PlanPermissions = {
  slug: "owner",
  name: "Owner",
  max_streams: 999,
  max_profiles: 99,
  quality_max: "4k",
  ads_free: true,
  priority_servers: true,
  downloads_allowed: true,
  priority_support: true,
  pdf_export: true,
  premium_badge: true,
  multi_status_selection: true,
  custom_avatar_upload: true,
  vip_support: true,
};

export const PLAN_BY_TYPE: Record<string, PlanPermissions> = {};

function permissionsFromConfig(plan: PremiumPlanConfig): PlanPermissions {
  return {
    slug: plan.slug,
    name: plan.name,
    max_streams: plan.streams_enabled ? plan.max_streams : 1,
    max_profiles: plan.profiles_enabled ? plan.max_profiles : 1,
    quality_max: plan.quality_enabled ? plan.quality_max : "hd",
    ads_free: plan.ads_free,
    priority_servers: plan.priority_servers,
    downloads_allowed: plan.downloads_allowed,
    priority_support: plan.priority_support,
    pdf_export: plan.pdf_export,
    premium_badge: true,
    multi_status_selection: plan.multi_status_selection,
    custom_avatar_upload: plan.custom_avatar_upload,
    vip_support: plan.vip_support,
  };
}

export async function resolveUserPermissions(
  userId: string | null | undefined,
  roles: string[] = []
): Promise<PlanPermissions> {
  if (!userId) return FREE_PERMISSIONS;
  if (roles.includes("owner")) return OWNER_PERMISSIONS;

  const { data: prof } = await supabase
    .from("profiles")
    .select("subscription_status, plan_type, subscription_expires_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!prof) return FREE_PERMISSIONS;
  const status = (prof as any).subscription_status as string | null;
  const planType = (prof as any).plan_type as string | null;
  const expiresAt = (prof as any).subscription_expires_at as string | null;
  if (status !== "active" || !planType) return FREE_PERMISSIONS;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) return FREE_PERMISSIONS;

  const { data: plan } = await supabase
    .from("premium_plan_configs" as any)
    .select("*")
    .eq("slug", planType)
    .eq("enabled", true)
    .maybeSingle();

  if (!plan) return FREE_PERMISSIONS;
  return permissionsFromConfig((plan as unknown) as PremiumPlanConfig);
}
