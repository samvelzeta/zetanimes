import imageCompression from "browser-image-compression";

interface CompressOpts {
  maxWidthOrHeight: number;
  quality?: number; // 0-1
  maxSizeMB?: number;
}

/**
 * Comprime una imagen a WebP usando browser-image-compression.
 * - Avatares: 200px / 0.6 / ~0.05 MB
 * - Comprobantes: 800px / 0.7 / ~0.3 MB
 */
export async function compressToWebp(file: File, opts: CompressOpts): Promise<File> {
  try {
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: opts.maxWidthOrHeight,
      maxSizeMB: opts.maxSizeMB ?? 0.5,
      initialQuality: opts.quality ?? 0.6,
      fileType: "image/webp",
      useWebWorker: true,
    });
    // Renombrar a .webp para coherencia en Storage
    const newName = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([compressed], newName, { type: "image/webp" });
  } catch (err) {
    console.error("[image-compress] fallo, devuelvo original", err);
    return file;
  }
}

export const compressAvatar = (f: File) =>
  compressToWebp(f, { maxWidthOrHeight: 200, quality: 0.6, maxSizeMB: 0.08 });

export const compressProof = (f: File) =>
  compressToWebp(f, { maxWidthOrHeight: 800, quality: 0.7, maxSizeMB: 0.4 });

/**
 * Banners de perfil: se muestran a ~1200x400. Los reducimos a 1200px WebP.
 */
export const compressBanner = (f: File) =>
  compressToWebp(f, { maxWidthOrHeight: 1200, quality: 0.72, maxSizeMB: 0.25 });

/**
 * Marcos (PNG con transparencia). Mantiene PNG para conservar alpha,
 * limita a 512x512 y comprime hasta ~0.15 MB.
 */
export async function compressFramePng(file: File): Promise<File> {
  try {
    const imageCompression = (await import("browser-image-compression")).default;
    const compressed = await imageCompression(file, {
      maxWidthOrHeight: 512,
      maxSizeMB: 0.15,
      initialQuality: 0.85,
      fileType: "image/png",
      useWebWorker: true,
    });
    const newName = file.name.replace(/\.[^.]+$/, "") + ".png";
    return new File([compressed], newName, { type: "image/png" });
  } catch (err) {
    console.error("[compress-frame] fallo, devuelvo original", err);
    return file;
  }
}
