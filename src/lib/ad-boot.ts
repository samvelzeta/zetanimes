import { getAdsConfig } from "@/config/ads";

let adDomainsPrimed = false;

export function hasStoredAuthSession(): boolean {
  try {
    if (typeof window === "undefined") return false;

    return Object.keys(window.localStorage).some((key) => {
      if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) return false;

      const value = window.localStorage.getItem(key);
      return !!value && value !== "null" && value !== "{}";
    });
  } catch {
    return false;
  }
}

export function shouldBootAdsImmediately(loading: boolean, isPremium: boolean): boolean {
  if (isPremium) return false;
  if (!loading) return true;
  return !hasStoredAuthSession();
}

export function primeAdDomains() {
  if (adDomainsPrimed || typeof document === "undefined") return;
  adDomainsPrimed = true;

  const { adsterraBannerHost: bannerHost, adsterraNativeHost: nativeHost } = getAdsConfig();

  const links: Array<{ rel: string; href: string; crossOrigin?: string }> = [
    { rel: "dns-prefetch", href: bannerHost.replace(/^https?:/, "") },
    { rel: "preconnect", href: bannerHost, crossOrigin: "anonymous" },
    { rel: "dns-prefetch", href: nativeHost.replace(/^https?:/, "") },
    { rel: "preconnect", href: nativeHost, crossOrigin: "anonymous" },
  ];

  links.forEach(({ rel, href, crossOrigin }) => {
    const selector = `link[rel="${rel}"][href="${href}"]`;
    if (document.head.querySelector(selector)) return;

    const link = document.createElement("link");
    link.rel = rel;
    link.href = href;
    if (crossOrigin) link.crossOrigin = crossOrigin;
    document.head.appendChild(link);
  });
}