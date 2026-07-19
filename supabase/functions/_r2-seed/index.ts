import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "");
const SEED_TOKEN = Deno.env.get("R2_SEED_TOKEN")!;
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.headers.get("X-Seed-Token") !== SEED_TOKEN) {
    return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: corsHeaders });
  }
  const { key, contentType, b64 } = await req.json();
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const res = await aws.fetch(`${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`, {
    method: "PUT",
    body: bin,
    headers: {
      "Content-Type": contentType || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
  const ok = res.ok;
  return new Response(
    JSON.stringify({ ok, status: res.status, url: `${R2_PUBLIC_URL}/${key}` }),
    { status: ok ? 200 : 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
