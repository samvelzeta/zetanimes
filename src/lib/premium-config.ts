import { supabase } from "@/integrations/supabase/client";

export interface PremiumPlan {
  id: string;
  name: string;
  price_label: string;
  period: string; // monthly|yearly|lifetime|custom
  membership_type: "annual" | "lifetime";
  tier: string; // solo | duo | trio
  profile_count: number;
  simultaneous_sessions: number;
  features: string[];
  badge: string | null;
  accent_color: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface PremiumSettings {
  id: string;
  title: string;
  subtitle: string;
  description: string | null;
  character_image_url: string | null;
  checkout_character_image_url: string | null;
  character3_image_url: string | null;
  character_hover_text_1: string | null;
  character_hover_text_2: string | null;
  character_hover_text_3: string | null;
  companion_prompt: string | null;
  background_image_url: string | null;
  alt_payment_url: string | null;
  stripe_enabled: boolean;
  stripe_payment_url: string | null;
  layout_mode: "lateral" | "background";
  show_proof_form: boolean;
}

export async function listPremiumPlans(includeDisabled = false): Promise<PremiumPlan[]> {
  let q = supabase.from("premium_plans" as any).select("*").order("sort_order");
  if (!includeDisabled) q = q.eq("enabled", true);
  const { data } = await q;
  return ((data as any[]) || []).map((r) => ({
    ...r,
    features: Array.isArray(r.features) ? r.features : [],
  })) as PremiumPlan[];
}

export async function getPremiumSettings(): Promise<PremiumSettings | null> {
  const { data } = await supabase.from("premium_settings" as any).select("*").limit(1).maybeSingle();
  return (data as any) || null;
}

export async function savePremiumSettings(patch: Partial<PremiumSettings>): Promise<void> {
  const current = await getPremiumSettings();
  if (current) {
    await supabase.from("premium_settings" as any).update(patch).eq("id", current.id);
  } else {
    await supabase.from("premium_settings" as any).insert(patch as any);
  }
}

export async function upsertPlan(plan: Partial<PremiumPlan>): Promise<void> {
  if (plan.id) {
    const { id, ...rest } = plan;
    await supabase.from("premium_plans" as any).update(rest as any).eq("id", id);
  } else {
    await supabase.from("premium_plans" as any).insert(plan as any);
  }
}

export async function deletePlan(id: string): Promise<void> {
  await supabase.from("premium_plans" as any).delete().eq("id", id);
}

export async function uploadPremiumAsset(file: File, kind: "character" | "background" | "character2" | "character3"): Promise<string> {
  const ext = file.name.split(".").pop() || "png";
  const path = `${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("premium-assets").upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from("premium-assets").getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}
