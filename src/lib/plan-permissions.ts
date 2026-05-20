// Resolver dinámico del plan activo del usuario.
// Lee `premium_plans` desde la BD y mezcla con la membresía activa + roles.
// Se usa desde el hook `usePlanPermissions`.
import { supabase } from "@/integrations/supabase/client";

export interface PlanPermissions {
  slug: string;            // 'free' | 'solo' | 'duo' | 'trio' | 'owner' | custom
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

function fromPlanRow(row: any): PlanPermissions {
  return {
    slug: row.slug || row.tier || "free",
    name: row.name || row.slug,
    max_streams: row.max_streams ?? row.simultaneous_sessions ?? 1,
    max_profiles: row.max_profiles ?? row.profile_count ?? 1,
    quality_max: (row.quality_max as any) || "hd",
    ads_free: !!row.ads_free,
    priority_servers: !!row.priority_servers,
    downloads_allowed: !!row.downloads_allowed,
    pdf_export: !!row.pdf_export,
    premium_badge: !!row.premium_badge,
    multi_status_selection: !!row.multi_status_selection,
    custom_avatar_upload: !!row.custom_avatar_upload,
    vip_support: !!row.vip_support,
  };
}

export async function resolveUserPermissions(
  userId: string | null | undefined,
  roles: string[] = []
): Promise<PlanPermissions> {
  if (!userId) return FREE_PERMISSIONS;
  if (roles.includes("owner")) return OWNER_PERMISSIONS;

  // 1. Buscar membresía activa
  const { data: membership } = await supabase
    .from("premium_memberships")
    .select("plan_tier, status, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!membership) return FREE_PERMISSIONS;
  const notExpired = !membership.expires_at || new Date(membership.expires_at).getTime() > Date.now();
  if (!notExpired) return FREE_PERMISSIONS;

  const tier = membership.plan_tier;
  if (!tier) return FREE_PERMISSIONS;

  // 2. Buscar plan que coincida con el tier (o slug)
  const { data: plan } = await supabase
    .from("premium_plans" as any)
    .select("*")
    .or(`slug.eq.${tier},tier.eq.${tier}`)
    .eq("enabled", true)
    .limit(1)
    .maybeSingle();

  if (!plan) {
    // Fallback: si el usuario es 'premium' por rol pero no hay plan, tratarlo como DUO básico
    if (roles.includes("premium")) {
      return { ...FREE_PERMISSIONS, slug: "premium", name: "Premium", ads_free: true, max_streams: 2, max_profiles: 2, multi_status_selection: true, custom_avatar_upload: true, vip_support: true, pdf_export: true };
    }
    return FREE_PERMISSIONS;
  }
  return fromPlanRow(plan);
}
