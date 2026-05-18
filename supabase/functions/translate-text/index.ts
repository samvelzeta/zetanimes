import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_INPUT_LENGTH = 4000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Free translation via Google Translate public endpoint (no API key, no credits)
async function googleTranslate(text: string, target = "es", source = "auto"): Promise<string> {
  // Split into chunks <= 2000 chars to avoid URL length limits
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
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });
    if (!res.ok) throw new Error(`gt ${res.status}`);
    const data = await res.json();
    // data[0] is array of [translatedSegment, originalSegment, ...]
    const out = Array.isArray(data?.[0])
      ? data[0].map((seg: any) => (Array.isArray(seg) ? seg[0] : "")).join("")
      : "";
    translatedChunks.push(out);
  }
  return translatedChunks.join("");
}

// Fallback: MyMemory (free, 5000 chars/day per IP, no key)
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, target, source } = await req.json();
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

    return new Response(JSON.stringify({ translated: translated || cleanText }), {
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
