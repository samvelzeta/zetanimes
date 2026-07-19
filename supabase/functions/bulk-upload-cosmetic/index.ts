import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "");
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const BRIDGE_SECRET = Deno.env.get("BULK_UPLOAD_TOKEN")!;

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_FOLDERS = new Set(["frames", "banners", "premium-bg"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (req.headers.get("X-Bridge-Secret") !== BRIDGE_SECRET) {
      return json({ error: "Forbidden" }, 403);
    }
    const body = await req.json();
    const folder = String(body.folder || "").toLowerCase();
    const filename = String(body.filename || "").replace(/[^a-z0-9._-]/gi, "_");
    const contentType = String(body.content_type || "application/octet-stream");
    const b64 = String(body.base64 || "");
    if (!ALLOWED_FOLDERS.has(folder)) return json({ error: "invalid folder" }, 400);
    if (!filename) return json({ error: "filename required" }, 400);
    if (!b64) return json({ error: "base64 required" }, 400);

    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const key = `${folder}/${filename}`;
    const res = await aws.fetch(`${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`, {
      method: "PUT",
      body: bin,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
    if (!res.ok) {
      const txt = await res.text();
      return json({ error: "upload failed", status: res.status, detail: txt.slice(0, 300) }, 502);
    }
    return json({ ok: true, url: `${R2_PUBLIC_URL}/${key}`, key });
  } catch (e: any) {
    return json({ error: e?.message ?? "internal" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
