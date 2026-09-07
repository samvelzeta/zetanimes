/* ─────────────────────────────────────────────────────────────
   ZetAnime · CÓDIGOS DE ANUNCIOS (Adsterra + Clickadilla / VAST)

   Este archivo se puede editar DIRECTAMENTE en el hosting
   (public_html/ads.config.js) SIN recompilar la página.
   Cambia los códigos, guarda y recarga el sitio.
   ───────────────────────────────────────────────────────────── */
window.__ZET_ADS__ = {
  // Dominios de los scripts (normalmente no se tocan)
  adsterraBannerHost: "https://www.highperformanceformat.com",
  adsterraNativeHost: "https://pl29176506.profitablecpmratenetwork.com",

  // Claves de banner Adsterra por tamaño
  banners: {
    "728x90": "1d178d24c436e987f0076c89491f7ba5",
    "468x60": "8672e32915f1e9d41edf058deec91989",
    "300x250": "b411f21fa26a4e8427eb13433959b4e8",
    "160x600": "d4813a34656155529b56e4655b81cbdb",
    "160x300": "ab525e23c9a041206c6d3096e5581274",
  },

  // Banner nativo (tarjetas dentro de los carruseles)
  nativeKey: "f22e36f62a5acf07d25a8dd129e84655",

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
