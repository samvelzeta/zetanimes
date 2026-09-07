// URL canónica pública del sitio. Los correos de verificación siempre
// apuntan aquí, sin importar desde qué dominio (preview de Lovable, Hostinger,
// APK) se haya registrado el usuario. Se puede sobreescribir con
// VITE_PUBLIC_SITE_URL en el .env del hosting.
export const SITE_URL: string =
  (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.replace(/\/+$/, "") ||
  "https://zetanimes.top";

export function siteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
