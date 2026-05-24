// Sistema de permisos basado en columnas de `profiles`:
//   subscription_status ('active' | 'inactive' | 'expired')
//   plan_type ('basico' | 'solo' | 'duo')
// Activación vía Ko-fi + webhook Make.com → edge function `kofi-webhook`.
import { supabase } from "@/integrations/supabase/client";

export interface PlanPermissions {
  slug: string;
  name: string;
  max_streams: number;
  max_profiles: number;
  quality_max: "hd" | "fhd" | "4k";
  ads_free: boolean;
  priority_servers: boolean;
  downloads_allowed: boolean;
  pdf_export: boolean;
  premium_badge: boolean;
  multi_status_selection: boolean;
  custom_avatar_upload: boolean;
  vip_support: boolean;
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
  pdf_export: false,
  premium_badge: false,
  multi_status_selection: false,
  custom_avatar_upload: false,
  vip_support: false,
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
  pdf_export: true,
  premium_badge: true,
  multi_status_selection: true,
  custom_avatar_upload: true,
  vip_support: true,
};

const BASICO: PlanPermissions = {
  slug: "basico",
  name: "Básico",
  max_streams: 1,
  max_profiles: 2,
  quality_max: "fhd",
  ads_free: true,
  priority_servers: false,
  downloads_allowed: false,
  pdf_export: false,
  premium_badge: true,
  multi_status_selection: false,
  custom_avatar_upload: false,
  vip_support: false,
};

const SOLO: PlanPermissions = {
  slug: "solo",
  name: "Plan Solo",
  max_streams: 2,
  max_profiles: 3,
  quality_max: "fhd",
  ads_free: true,
  priority_servers: true,
  downloads_allowed: true,
  pdf_export: true,
  premium_badge: true,
  multi_status_selection: true,
  custom_avatar_upload: true,
  vip_support: false,
};

const DUO: PlanPermissions = {
  slug: "duo",
  name: "Plan Dúo",
  max_streams: 3,
  max_profiles: 5,
  quality_max: "4k",
  ads_free: true,
  priority_servers: true,
  downloads_allowed: true,
  pdf_export: true,
  premium_badge: true,
  multi_status_selection: true,
  custom_avatar_upload: true,
  vip_support: true,
};

export const PLAN_BY_TYPE: Record<string, PlanPermissions> = {
  basico: BASICO,
  solo: SOLO,
  duo: DUO,
};

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

  return PLAN_BY_TYPE[planType] || FREE_PERMISSIONS;
}
