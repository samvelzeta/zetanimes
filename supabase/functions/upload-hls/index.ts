import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user + owner role
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get R2 settings
    const { data: settings } = await adminClient
      .from("app_settings")
      .select("key, value")
      .in("key", ["R2_ACCOUNT_ID", "R2_ACCESS_KEY", "R2_SECRET_KEY", "R2_BUCKET_NAME", "R2_PUBLIC_URL"]);

    const config: Record<string, string> = {};
    settings?.forEach((s: any) => { config[s.key] = s.value || ""; });

    if (!config.R2_ACCOUNT_ID || !config.R2_ACCESS_KEY || !config.R2_BUCKET_NAME) {
      return new Response(JSON.stringify({ 
        error: "R2 not configured",
        message: "Please configure R2 credentials in Settings tab first" 
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request - expect slug, episode_number, and file URLs or status update
    const body = await req.json();
    const { slug, episode_number, action } = body;

    if (!slug || !episode_number) {
      return new Response(JSON.stringify({ error: "slug and episode_number required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "register") {
      // Register episode as uploaded with HLS URL
      const hlsUrl = `${config.R2_PUBLIC_URL}/anime/${slug}/${episode_number}/master.m3u8`;
      
      const sources = { hls: [hlsUrl] };

      await adminClient.from("latino_episodes").upsert({
        slug,
        episode_number,
        sources,
        status: "uploaded",
        uploaded_by: user.id,
      } as any, { onConflict: "slug,episode_number" });

      return new Response(JSON.stringify({ 
        success: true, 
        message: "Episode registered",
        url: hlsUrl,
        sources 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_status") {
      const { status } = body;
      await adminClient.from("latino_episodes").upsert({
        slug,
        episode_number,
        status: status || "pending",
        uploaded_by: user.id,
      } as any, { onConflict: "slug,episode_number" });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
