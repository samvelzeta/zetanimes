// Elimina cuentas inactivas por más de 6 meses.
// Se ejecuta vía pg_cron (mensual). Usa service_role para llamar admin.deleteUser.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { assertInternalCaller } from "../_shared/cron-auth.ts";

const INACTIVITY_MONTHS = 6;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const denied = await assertInternalCaller(req, { staffOnly: true });
  if (denied) return new Response(denied.body, { status: denied.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - INACTIVITY_MONTHS);
  const cutoffIso = cutoff.toISOString();

  const deleted: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];
  let page = 1;
  const perPage = 200;

  try {
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users ?? [];
      if (users.length === 0) break;

      for (const u of users) {
        const lastSignIn = (u as any).last_sign_in_at || u.created_at;
        if (!lastSignIn) continue;
        if (new Date(lastSignIn).getTime() >= cutoff.getTime()) continue;

        // Nunca borrar owners/admins
        const { data: roles } = await supabase
          .from("user_roles").select("role").eq("user_id", u.id);
        const isStaff = (roles || []).some((r: any) => r.role === "owner" || r.role === "admin");
        if (isStaff) { skipped.push(u.id); continue; }

        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delErr) errors.push(`${u.id}: ${delErr.message}`);
        else deleted.push(u.id);
      }

      if (users.length < perPage) break;
      page += 1;
    }
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, deleted, errors }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({
    ok: true, cutoff: cutoffIso, deleted_count: deleted.length,
    skipped_count: skipped.length, errors,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
