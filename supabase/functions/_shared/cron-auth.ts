// Guard compartido para funciones internas/programadas.
// Acepta: header X-Cron-Secret válido (scheduler) o un JWT de usuario autenticado.
// Opcionalmente exige rol owner/admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GuardOptions {
  /** Si es true, sólo el secreto de cron o un usuario owner/admin pueden invocar. */
  staffOnly?: boolean;
}

export async function assertInternalCaller(
  req: Request,
  opts: GuardOptions = {},
): Promise<Response | null> {
  const cronSecret = Deno.env.get("CRON_SECRET");
  const provided = req.headers.get("x-cron-secret");
  if (cronSecret && provided && provided === cronSecret) return null;

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
  const unauthorized = () =>
    new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });

  if (!jwt) return unauthorized();

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await admin.auth.getUser(jwt);
  const user = data?.user;
  if (error || !user) return unauthorized();

  if (opts.staffOnly) {
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const isStaff = (roles || []).some(
      (r: { role: string }) => r.role === "owner" || r.role === "admin",
    );
    if (!isStaff) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return null;
}
