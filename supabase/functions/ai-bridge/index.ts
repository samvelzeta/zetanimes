// AI Bridge — puente entre Make.com (o cualquier servicio externo) y Lovable AI.
// Make.com llama aquí con un secreto compartido (X-Bridge-Secret), y este
// edge function reenvía la petición a Lovable AI usando LOVABLE_API_KEY
// internamente. La key real NUNCA sale del servidor.
//
// USO desde Make.com:
//   POST https://whrcwifudxqbrwgvhnud.supabase.co/functions/v1/ai-bridge
//   Headers:
//     Content-Type: application/json
//     X-Bridge-Secret: <el valor de AI_BRIDGE_SECRET>
//   Body:
//     {
//       "model": "google/gemini-2.5-flash",  // opcional, default gemini-2.5-flash
//       "messages": [
//         { "role": "system", "content": "Eres un asistente útil." },
//         { "role": "user", "content": "Hola" }
//       ]
//     }
//
// Respuesta (OpenAI-compatible):
//   { "choices": [ { "message": { "role": "assistant", "content": "..." } } ], ... }

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-bridge-secret, authorization, apikey",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // 1) Validar secreto compartido
  const bridgeSecret = Deno.env.get("AI_BRIDGE_SECRET");
  const provided = req.headers.get("x-bridge-secret");
  if (!bridgeSecret || !provided || provided !== bridgeSecret) {
    return json({ error: "Unauthorized" }, 401);
  }

  // 2) Validar payload
  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: "Body must include a non-empty 'messages' array" }, 400);
  }

  const model = typeof body?.model === "string" && body.model.length > 0
    ? body.model
    : "google/gemini-2.5-flash";

  // 3) Reenviar a Lovable AI con la key real (oculta para Make)
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  if (!lovableKey) {
    return json({ error: "LOVABLE_API_KEY not configured" }, 500);
  }

  try {
    const aiRes = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        ...(body.temperature !== undefined ? { temperature: body.temperature } : {}),
        ...(body.max_tokens !== undefined ? { max_tokens: body.max_tokens } : {}),
        ...(body.tools !== undefined ? { tools: body.tools } : {}),
      }),
    });

    const text = await aiRes.text();

    if (aiRes.status === 429) {
      return json({ error: "Rate limit exceeded", upstream: text }, 429);
    }
    if (aiRes.status === 402) {
      return json({ error: "Lovable AI credits exhausted", upstream: text }, 402);
    }
    if (!aiRes.ok) {
      return json({ error: "Lovable AI error", status: aiRes.status, upstream: text }, 502);
    }

    return new Response(text, {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return json({ error: "Bridge fetch failed", detail: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}
