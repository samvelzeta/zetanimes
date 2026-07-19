import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AwsClient } from "npm:aws4fetch@1.0.20";

const R2_ACCOUNT_ID = Deno.env.get("R2_ACCOUNT_ID")!;
const R2_ACCESS_KEY_ID = Deno.env.get("R2_ACCESS_KEY_ID")!;
const R2_SECRET_ACCESS_KEY = Deno.env.get("R2_SECRET_ACCESS_KEY")!;
const R2_BUCKET_NAME = Deno.env.get("R2_BUCKET_NAME")!;
const R2_PUBLIC_URL = Deno.env.get("R2_PUBLIC_URL")!.replace(/\/+$/, "");
const R2_ENDPOINT = `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY_ID,
  secretAccessKey: R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});

const ALLOWED_FOLDERS = new Set(["frames", "banners", "premium-bg", "genres", "og"]);
const ALLOWED_MIME = new Set(["image/webp", "image/png", "image/jpeg"]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) return json({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    // Must be owner or admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = (roles || []).some((r: any) => r.role === "owner" || r.role === "admin");
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") || "").toLowerCase();
    const filenameHint = String(form.get("filename") || "");

    if (!(file instanceof File)) return json({ error: "file required" }, 400);
    if (!ALLOWED_FOLDERS.has(folder)) return json({ error: "invalid folder" }, 400);
    if (file.size > MAX_BYTES) return json({ error: "file too large" }, 400);
    const contentType = file.type || "application/octet-stream";
    if (!ALLOWED_MIME.has(contentType)) return json({ error: "invalid mime" }, 400);

    const ext = contentType === "image/png" ? "png" : contentType === "image/jpeg" ? "jpg" : "webp";
    const safeName = filenameHint
      ? filenameHint.replace(/[^a-z0-9._-]/gi, "_").slice(0, 60)
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const key = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

    const body = new Uint8Array(await file.arrayBuffer());
    const putUrl = `${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`;
    const res = await aws.fetch(putUrl, {
      method: "PUT",
      body,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("R2 PUT failed", res.status, txt);
      return json({ error: "upload failed", status: res.status, detail: txt.slice(0, 300) }, 502);
    }

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return json({ ok: true, url: publicUrl, key });
  } catch (e: any) {
    console.error("upload-cosmetic error", e);
    return json({ error: e?.message ?? "internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
