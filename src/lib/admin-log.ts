import { supabase } from "@/integrations/supabase/client";

export type AdminArea =
  | "tracker"
  | "videos"
  | "slugs"
  | "episodes"
  | "hidden"
  | "reports"
  | "apk"
  | "notifications"
  | "payments"
  | "roles"
  | "other";

export interface LogActivityInput {
  area: AdminArea;
  action: string;
  summary: string;
  target_type?: string;
  target_id?: string;
  anilist_id?: number | null;
  anime_title?: string | null;
  episode_number?: number | null;
  metadata?: Record<string, any>;
}

export async function logAdminActivity(input: LogActivityInput) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("user_id", user.id)
      .maybeSingle();

    const actor_name = prof?.display_name || prof?.username || user.email || "Admin";

    await (supabase.from("admin_activity_log") as any).insert({
      actor_id: user.id,
      actor_name,
      area: input.area,
      action: input.action,
      summary: input.summary,
      target_type: input.target_type ?? null,
      target_id: input.target_id ?? null,
      anilist_id: input.anilist_id ?? null,
      anime_title: input.anime_title ?? null,
      episode_number: input.episode_number ?? null,
      metadata: input.metadata ?? {},
    });
  } catch (e) {
    console.warn("[admin-log] failed", e);
  }
}
