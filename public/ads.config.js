/* ─────────────────────────────────────────────────────────────
   ZetAnime · CÓDIGOS DE ANUNCIOS (Adsterra + Clickadilla / VAST)

   Este archivo se puede editar DIRECTAMENTE en el hosting
   (public_html/ads.config.js) SIN recompilar la página.
   Cambia los códigos, guarda y recarga el sitio.
   ───────────────────────────────────────────────────────────── */
window.__ZET_ADS__ = {
  // Dominios de los scripts (normalmente no se tocan)
  adsterraBannerHost: "https://www.highrevenueformat.com",
  adsterraNativeHost: "https://pl31283085.profitableratecpmnetwork.com",

  // Claves de banner Adsterra por tamaño
  banners: {
    "728x90": "eebb19fcf28c2907bf6e9e7c31cd7790",
    "468x60": "e7c89c10abea8be0ca7ba73eb567b59b",
    "300x250": "a24e5ed09cc43dbd1d28fd3dacc6d8d9",
    "160x600": "206a77b367bee5bdf0baaa360f8813ea",
    "160x300": "618901f4115f0cd2c0fccf606542ce2c",
    "320x50": "77756600bf28ba3f4c24b79865c14ec7",
  },

  // Banner nativo (tarjetas dentro de los carruseles)
  nativeKey: "a4634fe6810bcceab4700c8b656fb61d",

  // Anuncios de video VAST (Clickadilla). Puedes añadir o quitar spots.
  vastPool: [
    "https://vast.yomeno.xyz/vast?spot_id=1496604",
    "https://vast.yomeno.xyz/vast?spot_id=1496607",
    "https://vast.yomeno.xyz/vast?spot_id=1496606",
    "https://vast.yomeno.xyz/vast?spot_id=1496608",
    "https://vast.yomeno.xyz/vast?spot_id=1496609",
    "https://vast.yomeno.xyz/vast?spot_id=1496610",
  ],
};
