import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_INPUT_LENGTH = 4000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require authentication to prevent abuse of AI quota
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { text } = await req.json();
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Clean HTML tags + cap length to limit abuse
    const cleanText = text.replace(/<[^>]*>/g, "").trim().slice(0, MAX_INPUT_LENGTH);
    if (!cleanText) {
      return new Response(JSON.stringify({ translated: "" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Eres un traductor profesional. Traduce el siguiente texto del inglés al español de manera natural y fluida. Solo devuelve la traducción, sin explicaciones ni texto adicional."
          },
          { role: "user", content: cleanText }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Translation API error:", err);
      return new Response(JSON.stringify({ translated: cleanText }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await response.json();
    const translated = data.choices?.[0]?.message?.content?.trim() || cleanText;

    return new Response(JSON.stringify({ translated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Translation error:", e);
    return new Response(JSON.stringify({ error: errorMessage(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
