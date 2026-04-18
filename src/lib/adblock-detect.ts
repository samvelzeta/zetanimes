// Detector de Adblock combinando dos heurísticas:
// 1) Bait DOM: elemento con clases que los filtros (EasyList) ocultan/quitan.
// 2) Fetch a un script "señuelo" en un dominio de ads (Adsterra). Si lo bloquea
//    el navegador/extension, lanza error o status 0.
// Devuelve true si detecta bloqueo.
export async function detectAdblock(): Promise<boolean> {
  const baitBlocked = await new Promise<boolean>((resolve) => {
    const bait = document.createElement("div");
    bait.className =
      "adsbox ad-banner ad-placement adsbygoogle ad_unit pub_300x250 text-ad textAd text_ad text_ads text-ads text-ad-links";
    bait.style.cssText =
      "width:1px;height:1px;position:absolute;left:-9999px;top:-9999px;pointer-events:none;";
    bait.innerHTML = "&nbsp;";
    document.body.appendChild(bait);
    requestAnimationFrame(() => {
      const cs = window.getComputedStyle(bait);
      const blocked =
        bait.offsetParent === null ||
        bait.offsetHeight === 0 ||
        bait.clientHeight === 0 ||
        cs.display === "none" ||
        cs.visibility === "hidden";
      bait.remove();
      resolve(blocked);
    });
  });

  if (baitBlocked) return true;

  // Fetch a un script de Adsterra. uBlock/AdGuard lo bloquean (net::ERR_BLOCKED_BY_CLIENT).
  try {
    await fetch(
      "https://www.highperformanceformat.com/1d178d24c436e987f0076c89491f7ba5/invoke.js",
      { method: "HEAD", mode: "no-cors", cache: "no-store" }
    );
    return false;
  } catch {
    return true;
  }
}
