import { supabase } from "@/integrations/supabase/client";

export type CosmeticFolder = "frames" | "banners" | "premium-bg";

/**
 * Sube una imagen cosmética (marco, banner o fondo premium) al bucket R2 vía edge function.
 * Devuelve la URL pública final servida desde el subdominio r2.dev (o dominio personalizado).
 */
export async function uploadCosmeticToR2(
  file: File,
  folder: CosmeticFolder,
  filenameHint?: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  if (filenameHint) form.append("filename", filenameHint);

  const { data, error } = await supabase.functions.invoke("upload-cosmetic", {
    body: form,
  });

  if (error) throw new Error(error.message || "Error subiendo a R2");
  if (!data?.url) throw new Error(data?.error || "Respuesta inválida del servidor");
  return data.url as string;
}
