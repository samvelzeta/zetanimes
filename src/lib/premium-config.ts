// [DEPRECATED] El sistema de planes/configuración premium dinámica fue eliminado.
// Mantengo tipos vacíos por compatibilidad con cualquier import residual.
export interface PremiumPlan {
  id: string;
  slug?: string;
  name: string;
  price_label: string;
  features: string[];
  badge?: string | null;
  accent_color?: string | null;
  enabled?: boolean;
}
export interface PremiumSettings {
  id: string;
  title?: string;
  subtitle?: string;
}

export async function listPremiumPlans(): Promise<PremiumPlan[]> { return []; }
export async function getPremiumSettings(): Promise<PremiumSettings | null> { return null; }
export async function savePremiumSettings(): Promise<void> {}
export async function upsertPlan(): Promise<void> {}
export async function deletePlan(): Promise<void> {}
export async function uploadPremiumAsset(): Promise<string> { return ""; }
