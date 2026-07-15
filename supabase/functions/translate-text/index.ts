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

async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Free translation via Google Translate public endpoint (no API key, no credits)
async function googleTranslate(text: string, target = "es", source = "auto"): Promise<string> {
  const chunks: string[] = [];
  const max = 1800;
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= max) {
      chunks.push(remaining);
      break;
    }
    let cut = remaining.lastIndexOf(". ", max);
    if (cut < max * 0.5) cut = remaining.lastIndexOf(" ", max);
    if (cut <= 0) cut = max;
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).trimStart();
  }

  const translatedChunks: string[] = [];
  for (const chunk of chunks) {
    const url =
      `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=` +
      encodeURIComponent(chunk);
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`gt ${res.status}`);
    const data = await res.json();
    const out = Array.isArray(data?.[0])
      ? data[0].map((seg: any) => (Array.isArray(seg) ? seg[0] : "")).join("")
      : "";
    translatedChunks.push(out);
  }
  return translatedChunks.join("");
}

async function myMemoryTranslate(text: string, target = "es", source = "en"): Promise<string> {
  const url =
    `https://api.mymemory.translated.net/get?q=` +
    encodeURIComponent(text.slice(0, 500)) +
    `&langpair=${source}|${target}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`mm ${res.status}`);
  const data = await res.json();
  return data?.responseData?.translatedText || text;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { text, target, source, anilistId } = body || {};
    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "text required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanText = text.replace(/<[^>]*>/g, "").trim().slice(0, MAX_INPUT_LENGTH);
    if (!cleanText) {
      return new Response(JSON.stringify({ translated: "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tgt = (typeof target === "string" && target) || "es";
    const src = (typeof source === "string" && source) || "auto";
    const aid = Number.isFinite(Number(anilistId)) ? Number(anilistId) : null;
    const hash = await sha256Hex(cleanText);

    // 1) DB cache lookup (only for anime synopses, keyed by anilist_id)
    if (aid && tgt === "es") {
      const { data: cached } = await admin
        .from("anime_synopsis_es")
        .select("translated_text, source_hash")
        .eq("anilist_id", aid)
        .maybeSingle();
      if (cached?.translated_text && cached.source_hash === hash) {
        return new Response(
          JSON.stringify({ translated: cached.translated_text, cached: true }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // 2) Translate via free providers
    let translated = "";
    try {
      translated = await googleTranslate(cleanText, tgt, src);
    } catch (e) {
      console.warn("Google translate failed, trying MyMemory:", errorMessage(e));
      try {
        translated = await myMemoryTranslate(cleanText, tgt, src === "auto" ? "en" : src);
      } catch (e2) {
        console.error("MyMemory failed:", errorMessage(e2));
        translated = cleanText;
      }
    }

    const finalText = translated || cleanText;

    // 3) Save to DB cache (only synopsis with anilist_id, target=es)
    if (aid && tgt === "es" && finalText && finalText !== cleanText) {
      admin
        .from("anime_synopsis_es")
        .upsert(
          { anilist_id: aid, translated_text: finalText, source_hash: hash, updated_at: new Date().toISOString() },
          { onConflict: "anilist_id" }
        )
        .then(({ error }) => {
          if (error) console.error("cache upsert error:", error.message);
        });
    }

    return new Response(JSON.stringify({ translated: finalText, cached: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Translation error:", e);
    return new Response(JSON.stringify({ error: errorMessage(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
