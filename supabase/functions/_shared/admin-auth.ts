import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Verifica que el request venga de un usuario autenticado con rol owner/admin.
 * Devuelve { ok: true, userId } o { ok: false, status, error }.
 */
export async function requireAdmin(req: Request): Promise<
  { ok: true; userId: string } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!/^Bearer\s+.+/i.test(authHeader)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: userRes, error } = await admin.auth.getUser(token);
  const uid = userRes?.user?.id;
  if (error || !uid) return { ok: false, status: 401, error: "unauthorized" };

  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", uid)
    .in("role", ["owner", "admin"]);

  if (!roles?.length) return { ok: false, status: 403, error: "forbidden" };
  return { ok: true, userId: uid };
}
