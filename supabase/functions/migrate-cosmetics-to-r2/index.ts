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

const SUPA_URL = Deno.env.get("SUPABASE_URL")!;
const SUPA_SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STORAGE_BUCKET = "premium-assets";
const STORAGE_PUBLIC_PREFIX = `${SUPA_URL}/storage/v1/object/public/${STORAGE_BUCKET}/`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: only owner/admin can trigger
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPA_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (!claims?.claims) return json({ error: "Unauthorized" }, 401);
    const uid = claims.claims.sub as string;
    const { data: roles } = await userClient.from("user_roles").select("role").eq("user_id", uid);
    if (!(roles || []).some((r: any) => r.role === "owner" || r.role === "admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const admin = createClient(SUPA_URL, SUPA_SERVICE);

    // Collect targets
    type Target = { table: string; id?: string; key?: string; url: string; folder: string };
    const targets: Target[] = [];

    const { data: frames } = await admin.from("admin_frames").select("id,image_url");
    (frames || []).forEach((r: any) => {
      if (r.image_url && r.image_url.startsWith(STORAGE_PUBLIC_PREFIX)) {
        targets.push({ table: "admin_frames", id: r.id, url: r.image_url, folder: "frames" });
      }
    });
    const { data: banners } = await admin.from("admin_banners").select("id,image_url");
    (banners || []).forEach((r: any) => {
      if (r.image_url && r.image_url.startsWith(STORAGE_PUBLIC_PREFIX)) {
        targets.push({ table: "admin_banners", id: r.id, url: r.image_url, folder: "banners" });
      }
    });
    const { data: bg } = await admin
      .from("app_settings")
      .select("key,value")
      .eq("key", "premium_bg_url")
      .maybeSingle();
    if (bg?.value && String(bg.value).startsWith(STORAGE_PUBLIC_PREFIX)) {
      targets.push({ table: "app_settings", key: "premium_bg_url", url: bg.value, folder: "premium-bg" });
    }

    const results: any[] = [];
    for (const t of targets) {
      try {
        const storagePath = t.url.slice(STORAGE_PUBLIC_PREFIX.length);
        // Download from Supabase storage
        const dl = await admin.storage.from(STORAGE_BUCKET).download(storagePath);
        if (dl.error || !dl.data) throw new Error(`download failed: ${dl.error?.message}`);
        const blob = dl.data;
        const buf = new Uint8Array(await blob.arrayBuffer());
        const contentType = blob.type || "image/webp";
        const filename = storagePath.split("/").pop() || `file-${Date.now()}`;
        const key = `${t.folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${filename}`;

        // Upload to R2
        const putRes = await aws.fetch(`${R2_ENDPOINT}/${R2_BUCKET_NAME}/${key}`, {
          method: "PUT",
          body: buf,
          headers: {
            "Content-Type": contentType,
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
        if (!putRes.ok) throw new Error(`R2 PUT ${putRes.status}: ${(await putRes.text()).slice(0, 200)}`);

        const publicUrl = `${R2_PUBLIC_URL}/${key}`;

        // Update DB
        if (t.table === "app_settings") {
          await admin.from("app_settings").update({ value: publicUrl }).eq("key", t.key!);
        } else {
          await admin.from(t.table).update({ image_url: publicUrl }).eq("id", t.id!);
        }

        // Delete from Supabase storage
        await admin.storage.from(STORAGE_BUCKET).remove([storagePath]);

        results.push({ ok: true, from: t.url, to: publicUrl, table: t.table });
      } catch (e: any) {
        results.push({ ok: false, from: t.url, table: t.table, error: e?.message ?? String(e) });
      }
    }

    return json({ ok: true, migrated: results.filter((r) => r.ok).length, total: targets.length, results });
  } catch (e: any) {
    console.error("migrate-cosmetics-to-r2 error", e);
    return json({ error: e?.message ?? "internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
