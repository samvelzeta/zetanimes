// Gate de anuncios Clickadilla (Anti-Adblock) sobre el player.
//
// Flujo estricto:
//   1) En cuanto toca anuncio, bloqueamos el player original: pause(), autoplay=false,
//      play() temporalmente neutralizado y eventos de reproducción capturados.
//   2) Mostramos un preload limpio mientras Clickadilla descarga/renderiza.
//   3) Inyectamos Clickadilla en un host oculto; cuando aparece su iframe/overlay,
//      ocultamos nuestro loader para que el anuncio domine la pantalla.
//   4) Al cerrarse el anuncio, removemos el bloqueo y reanudamos el anime.
//
// Lógica de frecuencia (1 sí / 1 no) + reset por inactividad 30 min +
// exención Premium se mantienen.
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  episodeKey: string;
}

const COUNTER_KEY = "zet_ad_counter";
const LAST_ACTIVITY_KEY = "zet_last_activity";
const LAST_EP_KEY = "zet_ad_last_ep";
const AD_LOADING_KEY = "zet_ad_loading";
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const SCRIPT_MARK = "data-zet-clickadilla-ad";
const PRELOAD_SCRIPT_MARK = "data-zet-clickadilla-preload";
const OVERLAY_ID = "zet-clickadilla-overlay-host";
const PRELOAD_HOST_ID = "zet-clickadilla-preload-host";
const AD_LOAD_TIMEOUT_MS = 7_000;
const EMERGENCY_SKIP_MS = 5_000;
const AD_CLOSE_DEBOUNCE_MS = 1_200;
const AD_READY_STABLE_MS = 900;
const AD_MIN_VISIBLE_MS = 2_500;
const PLAYER_BLOCK_EVENTS = ["play", "playing", "loadeddata", "canplay", "volumechange"] as const;
const AD_SIGNATURE = /wpadmngr|clickadilla|admpid|admngr|admanager|adsco|crsksu|padmngr|supply-side/i;
const AD_CLOSE_SIGNATURE = /skip|saltar|omitir|close|cerrar|dismiss|cl-skip|ad-skip|×|✕/i;
const PRECONNECT_HOSTS = [
  "https://js.wpadmngr.com",
  "https://adblock-proxy-supply-side.crsksu.com",
] as const;
const PRELOAD_SCRIPT_HREF = "https://js.wpadmngr.com/static/adManager.js";

declare global {
  interface Window {
    _preventAnimePlay?: EventListener;
    _zetClickadillaPreloaded?: boolean;
  }
}

// Script Clickadilla Anti-Adblock (sin modificar)
const CLICKADILLA_SCRIPT_SRC = `function R(K,h){var O=X();return R=function(p,E){p=p-0x87;var Z=O[p];return Z;},R(K,h);}(function(K,h){var Xo=R,O=K();while(!![]){try{var p=parseInt(Xo(0xac))/0x1*(-parseInt(Xo(0x90))/0x2)+parseInt(Xo(0xa5))/0x3*(-parseInt(Xo(0x8d))/0x4)+parseInt(Xo(0xb5))/0x5*(-parseInt(Xo(0x93))/0x6)+parseInt(Xo(0x89))/0x7+-parseInt(Xo(0xa1))/0x8+parseInt(Xo(0xa7))/0x9*(parseInt(Xo(0xb2))/0xa)+parseInt(Xo(0x95))/0xb*(parseInt(Xo(0x9f))/0xc);if(p===h)break;else O['push'](O['shift']());}catch(E){O['push'](O['shift']());}}}(X,0x33565),(function(){var XG=R;function K(){var Xe=R,h=448333,O='a3klsam',p='a',E='db',Z=Xe(0xad),S=Xe(0xb6),o=Xe(0xb0),e='cs',D='k',c='pro',u='xy',Q='su',G=Xe(0x9a),j='se',C='cr',z='et',w='sta',Y='tic',g='adMa',V='nager',A=p+E+Z+S+o,s=p+E+Z+S+e,W=p+E+Z+D+'-'+c+u+'-'+Q+G+'-'+j+C+z,L='/'+w+Y+'/'+g+V+Xe(0x9c),T=A,t=s,I=W,N=null,r=null,n=new Date()[Xe(0x94)]()[Xe(0x8c)]('T')[0x0][Xe(0xa3)](/-/ig,'.')['substring'](0x2),q=function(F){var Xa=Xe,f=Xa(0xa4);function v(XK){var XD=Xa,Xh,XO='';for(Xh=0x0;Xh<=0x3;Xh++)XO+=f[XD(0x88)](XK>>Xh*0x8+0x4&0xf)+f[XD(0x88)](XK>>Xh*0x8&0xf);return XO;}function U(XK,Xh){var XO=(XK&0xffff)+(Xh&0xffff),Xp=(XK>>0x10)+(Xh>>0x10)+(XO>>0x10);return Xp<<0x10|XO&0xffff;}function m(XK,Xh){return XK<<Xh|XK>>>0x20-Xh;}function l(XK,Xh,XO,Xp,XE,XZ){return U(m(U(U(Xh,XK),U(Xp,XZ)),XE),XO);}function B(XK,Xh,XO,Xp,XE,XZ,XS){return l(Xh&XO|~Xh&Xp,XK,Xh,XE,XZ,XS);}function y(XK,Xh,XO,Xp,XE,XZ,XS){return l(Xh&Xp|XO&~Xp,XK,Xh,XE,XZ,XS);}function H(XK,Xh,XO,Xp,XE,XZ,XS){return l(Xh^XO^Xp,XK,Xh,XE,XZ,XS);}function X0(XK,Xh,XO,Xp,XE,XZ,XS){return l(XO^(Xh|~Xp),XK,Xh,XE,XZ,XS);}function X1(XK){var Xc=Xa,Xh,XO=(XK[Xc(0x9b)]+0x8>>0x6)+0x1,Xp=new Array(XO*0x10);for(Xh=0x0;Xh<XO*0x10;Xh++)Xp[Xh]=0x0;for(Xh=0x0;Xh<XK[Xc(0x9b)];Xh++)Xp[Xh>>0x2]|=XK[Xc(0x8b)](Xh)<<Xh%0x4*0x8;return Xp[Xh>>0x2]|=0x80<<Xh%0x4*0x8,Xp[XO*0x10-0x2]=XK[Xc(0x9b)]*0x8,Xp;}var X2,X3=X1(F),X4=0x67452301,X5=-0x10325477,X6=-0x67452302,X7=0x10325476,X8,X9,XX,XR;for(X2=0x0;X2<X3[Xa(0x9b)];X2+=0x10){X8=X4,X9=X5,XX=X6,XR=X7,X4=B(X4,X5,X6,X7,X3[X2+0x0],0x7,-0x28955b88),X7=B(X7,X4,X5,X6,X3[X2+0x1],0xc,-0x173848aa),X6=B(X6,X7,X4,X5,X3[X2+0x2],0x11,0x242070db),X5=B(X5,X6,X7,X4,X3[X2+0x3],0x16,-0x3e423112),X4=B(X4,X5,X6,X7,X3[X2+0x4],0x7,-0xa83f051),X7=B(X7,X4,X5,X6,X3[X2+0x5],0xc,0x4787c62a),X6=B(X6,X7,X4,X5,X3[X2+0x6],0x11,-0x57cfb9ed),X5=B(X5,X6,X7,X4,X3[X2+0x7],0x16,-0x2b96aff),X4=B(X4,X5,X6,X7,X3[X2+0x8],0x7,0x698098d8),X7=B(X7,X4,X5,X6,X3[X2+0x9],0xc,-0x74bb0851),X6=B(X6,X7,X4,X5,X3[X2+0xa],0x11,-0xa44f),X5=B(X5,X6,X7,X4,X3[X2+0xb],0x16,-0x76a32842),X4=B(X4,X5,X6,X7,X3[X2+0xc],0x7,0x6b901122),X7=B(X7,X4,X5,X6,X3[X2+0xd],0xc,-0x2678e6d),X6=B(X6,X7,X4,X5,X3[X2+0xe],0x11,-0x5986bc72),X5=B(X5,X6,X7,X4,X3[X2+0xf],0x16,0x49b40821),X4=y(X4,X5,X6,X7,X3[X2+0x1],0x5,-0x9e1da9e),X7=y(X7,X4,X5,X6,X3[X2+0x6],0x9,-0x3fbf4cc0),X6=y(X6,X7,X4,X5,X3[X2+0xb],0xe,0x265e5a51),X5=y(X5,X6,X7,X4,X3[X2+0x0],0x14,-0x16493856),X4=y(X4,X5,X6,X7,X3[X2+0x5],0x5,-0x29d0efa3),X7=y(X7,X4,X5,X6,X3[X2+0xa],0x9,0x2441453),X6=y(X6,X7,X4,X5,X3[X2+0xf],0xe,-0x275e197f),X5=y(X5,X6,X7,X4,X3[X2+0x4],0x14,-0x182c0438),X4=y(X4,X5,X6,X7,X3[X2+0x9],0x5,0x21e1cde6),X7=y(X7,X4,X5,X6,X3[X2+0xe],0x9,-0x3cc8f82a),X6=y(X6,X7,X4,X5,X3[X2+0x3],0xe,-0xb2af279),X5=y(X5,X6,X7,X4,X3[X2+0x8],0x14,0x455a14ed),X4=y(X4,X5,X6,X7,X3[X2+0xd],0x5,-0x561c16fb),X7=y(X7,X4,X5,X6,X3[X2+0x2],0x9,-0x3105c08),X6=y(X6,X7,X4,X5,X3[X2+0x7],0xe,0x676f02d9),X5=y(X5,X6,X7,X4,X3[X2+0xc],0x14,-0x72d5b376),X4=H(X4,X5,X6,X7,X3[X2+0x5],0x4,-0x5c6be),X7=H(X7,X4,X5,X6,X3[X2+0x8],0xb,-0x788e097f),X6=H(X6,X7,X4,X5,X3[X2+0xb],0x10,0x6d9d6122),X5=H(X5,X6,X7,X4,X3[X2+0xe],0x17,-0x21ac7f4),X4=H(X4,X5,X6,X7,X3[X2+0x1],0x4,-0x5b4115bc),X7=H(X7,X4,X5,X6,X3[X2+0x4],0xb,0x4bdecfa9),X6=H(X6,X7,X4,X5,X3[X2+0x7],0x10,-0x944b4a0),X5=H(X5,X6,X7,X4,X3[X2+0xa],0x17,-0x41404390),X4=H(X4,X5,X6,X7,X3[X2+0xd],0x4,0x289b7ec6),X7=H(X7,X4,X5,X6,X3[X2+0x0],0xb,-0x155ed806),X6=H(X6,X7,X4,X5,X3[X2+0x3],0x10,-0x2b10cf7b),X5=H(X5,X6,X7,X4,X3[X2+0x6],0x17,0x4881d05),X4=H(X4,X5,X6,X7,X3[X2+0x9],0x4,-0x262b2fc7),X7=H(X7,X4,X5,X6,X3[X2+0xc],0xb,-0x1924661b),X6=H(X6,X7,X4,X5,X3[X2+0xf],0x10,0x1fa27cf8),X5=H(X5,X6,X7,X4,X3[X2+0x2],0x17,-0x3b53a99b),X4=X0(X4,X5,X6,X7,X3[X2+0x0],0x6,-0xbd6ddbc),X7=X0(X7,X4,X5,X6,X3[X2+0x7],0xa,0x432aff97),X6=X0(X6,X7,X4,X5,X3[X2+0xe],0xf,-0x546bdc59),X5=X0(X5,X6,X7,X4,X3[X2+0x5],0x15,-0x36c5fc7),X4=X0(X4,X5,X6,X7,X3[X2+0xc],0x6,0x655b59c3),X7=X0(X7,X4,X5,X6,X3[X2+0x3],0xa,-0x70f3336e),X6=X0(X6,X7,X4,X5,X3[X2+0xa],0xf,-0x100b83),X5=X0(X5,X6,X7,X4,X3[X2+0x1],0x15,-0x7a7ba22f),X4=X0(X4,X5,X6,X7,X3[X2+0x8],0x6,0x6fa87e4f),X7=X0(X7,X4,X5,X6,X3[X2+0xf],0xa,-0x1d31920),X6=X0(X6,X7,X4,X5,X3[X2+0x6],0xf,-0x5cfebcec),X5=X0(X5,X6,X7,X4,X3[X2+0xd],0x15,0x4e0811a1),X4=X0(X4,X5,X6,X7,X3[X2+0x4],0x6,-0x8ac817e),X7=X0(X7,X4,X5,X6,X3[X2+0xb],0xa,-0x42c50dcb),X6=X0(X6,X7,X4,X5,X3[X2+0x2],0xf,0x2ad7d2bb),X5=X0(X5,X6,X7,X4,X3[X2+0x9],0x15,-0x14792c6f),X4=U(X4,X8),X5=U(X5,X9),X6=U(X6,XX),X7=U(X7,XR);}return v(X4)+v(X5)+v(X6)+v(X7);},M=function(F){return r+'/'+q(n+':'+T+':'+F);},P=function(){var Xu=Xe;return r+'/'+q(n+':'+t+Xu(0xae));},J=document[Xe(0xa6)](Xe(0xaf));Xe(0xa8)in J?(L=L[Xe(0xa3)]('.js',Xe(0x9d)),J[Xe(0x91)]='module'):(L=L[Xe(0xa3)](Xe(0x9c),Xe(0xb4)),J[Xe(0xb3)]=!![]),N=q(n+':'+I+':domain')[Xe(0xa9)](0x0,0xa)+Xe(0x8a),r=Xe(0x92)+q(N+':'+I)[Xe(0xa9)](0x0,0xa)+'.'+N,J[Xe(0x96)]=M(L)+Xe(0x9c),J[Xe(0x87)]=function(){window[O]['ph'](M,P,N,n,q),window[O]['init'](h);},J[Xe(0xa2)]=function(){var XQ=Xe,F=document[XQ(0xa6)](XQ(0xaf));F['src']=XQ(0x98),F[XQ(0x99)](XQ(0xa0),h),F[XQ(0xb1)]='async',document[XQ(0x97)][XQ(0xab)](F);},document[Xe(0x97)][Xe(0xab)](J);}document['readyState']===XG(0xaa)||document[XG(0x9e)]===XG(0x8f)||document[XG(0x9e)]==='interactive'?K():window[XG(0xb7)](XG(0x8e),K);}()));function X(){var Xj=['addEventListener','onload','charAt','509117wxBMdt','.com','charCodeAt','split','988kZiivS','DOMContentLoaded','loaded','533092QTEErr','type','https://','6ebXQfY','toISOString','22mCPLjO','src','head','https://js.wpadmngr.com/static/adManager.js','setAttribute','per','length','.js','.m.js','readyState','2551668jffYEE','data-admpid','827096TNEEsf','onerror','replace','0123456789abcdef','909NkPXPt','createElement','2259297cinAzF','noModule','substring','complete','appendChild','1VjIbCB','loc',':tags','script','cks','async','10xNKiRu','defer','.l.js','469955xpTljk','ksu'];X=function(){return Xj;};return X();}`;

function removeInjected() {
  document
    .querySelectorAll(`script[${SCRIPT_MARK}], script[src*="wpadmngr"], script[src*="adManager"], script[src*="admngr"]`)
    .forEach((n) => n.parentNode?.removeChild(n));
}

function ensurePassivePreloadHost() {
  let host = document.getElementById(PRELOAD_HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = PRELOAD_HOST_ID;
    host.setAttribute("aria-hidden", "true");
    host.style.cssText = "position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;left:-9999px;top:-9999px;";
    document.body.appendChild(host);
  }
  return host;
}

function warmUpClickadilla() {
  ensurePassivePreloadHost();

  PRECONNECT_HOSTS.forEach((href) => {
    if (!document.head.querySelector(`link[data-zet-ad-warmup][href="${href}"]`)) {
      const preconnect = document.createElement("link");
      preconnect.rel = "preconnect";
      preconnect.href = href;
      preconnect.crossOrigin = "anonymous";
      preconnect.setAttribute("data-zet-ad-warmup", "1");
      document.head.appendChild(preconnect);
    }

    const dnsHref = new URL(href).origin.replace(/^https:/, "//");
    if (!document.head.querySelector(`link[data-zet-ad-warmup][href="${dnsHref}"]`)) {
      const dns = document.createElement("link");
      dns.rel = "dns-prefetch";
      dns.href = dnsHref;
      dns.setAttribute("data-zet-ad-warmup", "1");
      document.head.appendChild(dns);
    }
  });

  if (!document.head.querySelector(`link[data-zet-ad-warmup][href="${PRELOAD_SCRIPT_HREF}"]`)) {
    const preload = document.createElement("link");
    preload.rel = "preload";
    preload.as = "script";
    preload.href = PRELOAD_SCRIPT_HREF;
    preload.crossOrigin = "anonymous";
    preload.setAttribute("data-zet-ad-warmup", "1");
    document.head.appendChild(preload);
  }

  safe(() => {
    fetch(PRELOAD_SCRIPT_HREF, { mode: "no-cors", cache: "force-cache", credentials: "omit" }).catch(() => undefined);
  });

  // Precarga pasiva: no dispara el anuncio, solo deja el manager en caché para el próximo capítulo.
  if (!window._zetClickadillaPreloaded) {
    window._zetClickadillaPreloaded = true;
    const host = ensurePassivePreloadHost();
    if (!host.querySelector(`script[${PRELOAD_SCRIPT_MARK}]`)) {
      const passiveScript = document.createElement("script");
      passiveScript.src = PRELOAD_SCRIPT_HREF;
      passiveScript.async = true;
      passiveScript.defer = true;
      passiveScript.setAttribute(PRELOAD_SCRIPT_MARK, "1");
      passiveScript.onerror = () => { window._zetClickadillaPreloaded = false; };
      host.appendChild(passiveScript);
    }
  }
}

function clearAdLoadingMarker() {
  localStorage.removeItem(AD_LOADING_KEY);
}

function hadInterruptedAdLoad() {
  return localStorage.getItem(AD_LOADING_KEY) === "true";
}

function isInsideAdHost(el: Element): boolean {
  const adHost = document.getElementById(OVERLAY_ID);
  return !!adHost && adHost.contains(el);
}

function isInsidePreloadHost(el: Element): boolean {
  const preloadHost = document.getElementById(PRELOAD_HOST_ID);
  return !!preloadHost && preloadHost.contains(el);
}

function getPlayerVideos(): HTMLVideoElement[] {
  return Array.from(document.querySelectorAll<HTMLVideoElement>("#zet-player-container video"))
    .filter((v) => !isInsideAdHost(v));
}

function getPlayerVideo(): HTMLVideoElement | null {
  return getPlayerVideos()[0] ?? null;
}

function getPlayerIframes(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>("#zet-player-container iframe"))
    .filter((f) => !isInsideAdHost(f));
}

interface LockedVideoState {
  el: HTMLVideoElement;
  muted: boolean;
  volume: number;
  autoplay: boolean;
  play: HTMLVideoElement["play"];
}

interface PlayerBlockState {
  videos: LockedVideoState[];
  iframes: Array<{ el: HTMLIFrameElement; src: string }>;
}

type ZetBlockedVideo = HTMLVideoElement & { __zetAdBlocked?: boolean };

function safe(action: () => void) {
  try {
    action();
  } catch {
    return;
  }
}

function lockVideoElement(v: HTMLVideoElement, state: PlayerBlockState, preventPlay: EventListener) {
  let saved = state.videos.find((item) => item.el === v);
  if (!saved) {
    saved = {
      el: v,
      muted: v.muted,
      volume: v.volume,
      autoplay: v.autoplay,
      play: v.play,
    };
    state.videos.push(saved);
    PLAYER_BLOCK_EVENTS.forEach((eventName) => v.addEventListener(eventName, preventPlay, true));
    safe(() => {
      v.play = function blockedAnimePlay() {
        safe(() => HTMLMediaElement.prototype.pause.call(this));
        return Promise.resolve();
      } as HTMLVideoElement["play"];
    });
  }

  safe(() => { v.autoplay = false; });
  safe(() => { v.pause(); });
  safe(() => { v.muted = true; });
  safe(() => { v.volume = 0; });
  (v as ZetBlockedVideo).__zetAdBlocked = true;
}

function blockPlayerBehind(state: PlayerBlockState, preventPlay: EventListener) {
  getPlayerVideos().forEach((v) => lockVideoElement(v, state, preventPlay));
  // Iframes de players externos: no podemos pause() → blankear su src corta el audio
  const iframes = getPlayerIframes();
  for (const f of iframes) {
    if (state.iframes.find((x) => x.el === f)) continue;
    const src = f.src;
    if (!src || src === "about:blank") continue;
    state.iframes.push({ el: f, src });
    safe(() => { f.src = "about:blank"; });
  }
}

function releasePlayerBehind(state: PlayerBlockState, preventPlay: EventListener) {
  const resumeTarget = state.videos[0]?.el ?? getPlayerVideo();

  for (const saved of state.videos) {
    PLAYER_BLOCK_EVENTS.forEach((eventName) => saved.el.removeEventListener(eventName, preventPlay, true));
    safe(() => { saved.el.play = saved.play; });
    safe(() => { saved.el.autoplay = saved.autoplay; });
    safe(() => { saved.el.muted = saved.muted; });
    safe(() => { saved.el.volume = saved.volume; });
    safe(() => { delete (saved.el as ZetBlockedVideo).__zetAdBlocked; });
  }
  for (const { el, src } of state.iframes) {
    safe(() => { el.src = src; });
  }
  state.videos = [];
  state.iframes = [];

  window.setTimeout(() => {
    const v = document.body.contains(resumeTarget) ? resumeTarget : getPlayerVideo();
    v?.play().catch(() => undefined);
  }, 80);
}

function injectClickadilla(host: HTMLElement) {
  removeInjected();
  const s = document.createElement("script");
  s.setAttribute("data-cfasync", "false");
  s.setAttribute(SCRIPT_MARK, "1");
  s.text = CLICKADILLA_SCRIPT_SRC;
  host.appendChild(s);
  console.info("[zetAds] Clickadilla Anti-Adblock inyectado");
}

// Heurística: nodos que Clickadilla / wpadmngr suelen añadir al body
function isClickadillaNode(node: Node): boolean {
  if (!(node instanceof HTMLElement)) return false;
  if (isInsidePreloadHost(node)) return false;
  const tag = node.tagName;
  const adMount = document.querySelector("[data-zet-clickadilla-mount]");
  if (adMount?.contains(node) && node !== adMount) {
    if (tag === "SCRIPT") return false;
    if (/IFRAME|OBJECT|EMBED|VIDEO|INS/.test(tag)) return true;
    if (node.querySelector?.("iframe, object, embed, video, button, [role='button']")) return true;
  }
  if (tag === "SCRIPT") {
    const src = (node as HTMLScriptElement).src || "";
    if (AD_SIGNATURE.test(src)) return true;
  }
  if (tag === "IFRAME") {
    const src = (node as HTMLIFrameElement).src || "";
    if (AD_SIGNATURE.test(src)) return true;
  }
  const id = node.id || "";
  const cls = typeof node.className === "string" ? node.className : "";
  if (AD_SIGNATURE.test(id + " " + cls)) return true;
  if (node.querySelector?.('iframe[src*="wpadmngr"], iframe[src*="clickadilla"], iframe[src*="adsco"], iframe[src*="crsksu"]')) return true;
  if (node.parentElement === document.body) {
    const style = window.getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    const zIndex = Number.parseInt(style.zIndex || "0", 10);
    if ((style.position === "fixed" || style.position === "absolute") && zIndex >= 50 && rect.width >= 120 && rect.height >= 80) return true;
  }
  return false;
}

function getClickadillaNodes(): HTMLElement[] {
  return Array.from(document.body.querySelectorAll<HTMLElement>("script, iframe, div, section, aside, ins"))
    .filter((node) => node.id !== OVERLAY_ID && isClickadillaNode(node));
}

function isRenderableAdNode(node: HTMLElement): boolean {
  if (node.tagName === "SCRIPT") return false;
  if (isInsidePreloadHost(node)) return false;
  if (node.tagName === "IFRAME") return true;
  const style = window.getComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
  const rect = node.getBoundingClientRect();
  return rect.width >= 120 && rect.height >= 80;
}

function hasAdCloseControl(): boolean {
  const nodes = getClickadillaNodes();
  for (const node of nodes) {
    const candidates = [node, ...Array.from(node.querySelectorAll<HTMLElement>("button, a, [role='button'], [aria-label], [title], [class], [id]"))];
    if (candidates.some((candidate) => {
      const text = (candidate.textContent || "").trim();
      const aria = candidate.getAttribute("aria-label") || "";
      const title = candidate.getAttribute("title") || "";
      const cls = typeof candidate.className === "string" ? candidate.className : "";
      return AD_CLOSE_SIGNATURE.test(`${text} ${aria} ${title} ${candidate.id} ${cls}`) || /^[xX]$/.test(text);
    })) return true;
  }
  return false;
}

function isAdCloseClick(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const control = target.closest<HTMLElement>("button, a, [role='button'], [aria-label], [title], [class], [id]");
  if (!control) return false;
  const text = (control.textContent || "").trim();
  const signature = `${text} ${control.getAttribute("aria-label") || ""} ${control.getAttribute("title") || ""} ${control.id} ${typeof control.className === "string" ? control.className : ""}`;
  return (AD_CLOSE_SIGNATURE.test(signature) || /^[xX]$/.test(text)) && getClickadillaNodes().some((node) => node.contains(control) || control.contains(node));
}

function removeClickadillaDom() {
  removeInjected();
  getClickadillaNodes().forEach((node) => node.parentNode?.removeChild(node));
}

export default function ClickadillaAdGate({ episodeKey }: Props) {
  const { isPremium, loading } = useAuth();
  const processedKeyRef = useRef<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const adMountRef = useRef<HTMLDivElement>(null);
  const forceSkipRef = useRef<(() => void) | null>(null);

  const [activeAdEpisodeKey, setActiveAdEpisodeKey] = useState<string | null>(null);
  const [adVisible, setAdVisible] = useState(false); // Clickadilla ya está pintando
  const [showEmergencySkip, setShowEmergencySkip] = useState(false);
  const show = activeAdEpisodeKey === episodeKey;

  useEffect(() => {
    if (!loading && !isPremium) warmUpClickadilla();
  }, [isPremium, loading]);

  // Decide sí/no y activa el overlay
  useEffect(() => {
    if (loading || isPremium || !episodeKey) return;
    if (processedKeyRef.current === episodeKey) return;
    processedKeyRef.current = episodeKey;

    const NOW = Date.now();
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    const storedCounter = localStorage.getItem(COUNTER_KEY);
    const lastEp = localStorage.getItem(LAST_EP_KEY);

    let counter: number;
    if (!lastActivity || storedCounter === null || NOW - parseInt(lastActivity, 10) > INACTIVITY_LIMIT_MS) {
      counter = 0;
    } else if (lastEp === episodeKey) {
      counter = parseInt(storedCounter, 10);
    } else {
      counter = parseInt(storedCounter, 10);
      if (!Number.isFinite(counter) || counter < 0) counter = 0;
    }

    const interruptedAdLoad = hadInterruptedAdLoad();
    const shouldShowAd = counter % 2 === 0 && !interruptedAdLoad;

    if (interruptedAdLoad) {
      console.warn("[zetAds] Carga anterior interrumpida; saltando anuncio para evitar bucle negro.");
      clearAdLoadingMarker();
      removeClickadillaDom();
      const oddCounter = counter % 2 === 0 ? counter + 1 : counter;
      localStorage.setItem(COUNTER_KEY, String(oddCounter));
      localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW));
      localStorage.setItem(LAST_EP_KEY, episodeKey);
      setActiveAdEpisodeKey(null);
      setAdVisible(false);
      setShowEmergencySkip(false);
      warmUpClickadilla();
      getPlayerVideo()?.play().catch(() => undefined);
      return;
    }

    if (shouldShowAd) {
      warmUpClickadilla();
      localStorage.setItem(AD_LOADING_KEY, "true");
      setActiveAdEpisodeKey(episodeKey);
      setAdVisible(false);
      setShowEmergencySkip(false);
    } else {
      setActiveAdEpisodeKey(null);
      removeClickadillaDom();
      warmUpClickadilla();
      console.info("[zetAds] Capítulo limpio, sin publicidad Clickadilla.");
    }

    const nextCounter = lastEp === episodeKey ? counter : counter + 1;
    localStorage.setItem(COUNTER_KEY, String(nextCounter));
    localStorage.setItem(LAST_ACTIVITY_KEY, String(NOW));
    localStorage.setItem(LAST_EP_KEY, episodeKey);
  }, [episodeKey, isPremium, loading]);

  // Cuando el overlay aparece: pausar video, inyectar script, observar aparición/cierre del ad
  useEffect(() => {
    if (!show) return;

    let closed = false;
    let clickadillaDetected = false;
    let renderableAdDetected = false;
    let adReadyDetected = false;
    let closeControlDetected = false;
    let closeIntentDetected = false;
    let unloading = false;
    let renderableSince = 0;
    let closeTimer: number | null = null;

    const playerBlock: PlayerBlockState = { videos: [], iframes: [] };

    const onPlayAttempt: EventListener = (event) => {
      // Cualquier intento de play mientras el anuncio está activo se cancela
      if (closed) return;
      event?.preventDefault();
      event?.stopImmediatePropagation();
      blockPlayerBehind(playerBlock, onPlayAttempt);
    };

    window._preventAnimePlay = onPlayAttempt;

    // Poll agresivo: mantiene el video pausado + mute + iframes del anime cortados.
    const pauseInterval = window.setInterval(() => {
      blockPlayerBehind(playerBlock, onPlayAttempt);
    }, 100);

    // Pausa absoluta antes de inyectar Clickadilla.
    blockPlayerBehind(playerBlock, onPlayAttempt);

    const finish = () => {
      if (closed) return;
      closed = true;
      clearAdLoadingMarker();
      setActiveAdEpisodeKey(null);
      setAdVisible(false);
      setShowEmergencySkip(false);
      removeClickadillaDom();
      safe(() => observer.disconnect());
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(emergencySkipTimer);
      window.clearInterval(detectInterval);
      if (closeTimer) window.clearTimeout(closeTimer);
      window.clearInterval(pauseInterval);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (window._preventAnimePlay === onPlayAttempt) delete window._preventAnimePlay;
      forceSkipRef.current = null;
      // Restaura audio + iframes y reanuda el video
      releasePlayerBehind(playerBlock, onPlayAttempt);
      warmUpClickadilla();
    };

    const scheduleCloseCheck = () => {
      if (closed || !adReadyDetected) return;
      if (closeTimer) window.clearTimeout(closeTimer);
      closeTimer = window.setTimeout(() => {
        if (closed) return;
        blockPlayerBehind(playerBlock, onPlayAttempt);
        const activeNodes = getClickadillaNodes().filter(isRenderableAdNode);
        const visibleLongEnough = Date.now() - renderableSince >= AD_MIN_VISIBLE_MS;
        if ((closeIntentDetected || closeControlDetected || visibleLongEnough) && activeNodes.length === 0) {
          console.info("[zetAds] Overlay Clickadilla cerrado; reanudando anime");
          finish();
        }
      }, AD_CLOSE_DEBOUNCE_MS);
    };

    const onDocumentClick = (event: MouseEvent) => {
      if (closed) return;
      if (isAdCloseClick(event.target)) {
        closeIntentDetected = true;
        blockPlayerBehind(playerBlock, onPlayAttempt);
        window.setTimeout(scheduleCloseCheck, 700);
      }
    };

    const onBeforeUnload = () => {
      unloading = true;
      localStorage.setItem(AD_LOADING_KEY, "true");
    };

    const detectAdState = () => {
      if (closed) return;
      blockPlayerBehind(playerBlock, onPlayAttempt);

      const nodes = getClickadillaNodes();
      const renderableNodes = nodes.filter(isRenderableAdNode);
      closeControlDetected = hasAdCloseControl();

      if (nodes.length > 0) clickadillaDetected = true;
      if (renderableNodes.length > 0) {
        renderableAdDetected = true;
        if (!renderableSince) renderableSince = Date.now();
        if (Date.now() - renderableSince >= AD_READY_STABLE_MS || closeControlDetected) adReadyDetected = true;
        setAdVisible(adReadyDetected);
        if (closeControlDetected) setShowEmergencySkip(false);
        if (closeTimer) {
          window.clearTimeout(closeTimer);
          closeTimer = null;
        }
        console.info("[zetAds] Overlay Clickadilla visible; player bloqueado");
        return;
      }

      // Si solo desapareció un nodo temporal de carga, NO reanudar todavía.
      // Reanudamos únicamente cuando ya hubo un ad real/estable y luego desapareció.
      if ((clickadillaDetected || renderableAdDetected) && adReadyDetected) scheduleCloseCheck();
    };

    forceSkipRef.current = () => {
      console.warn("[zetAds] Anuncio omitido por fallback de seguridad.");
      finish();
    };
    document.addEventListener("click", onDocumentClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);

    // Observa apariciones de nodos Clickadilla en el body
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.addedNodes.length > 0 || m.removedNodes.length > 0) detectAdState();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const detectInterval = window.setInterval(detectAdState, 250);

    // Inyecta en el host oculto del overlay para no mostrar cuadros transparentes.
    if (adMountRef.current) injectClickadilla(adMountRef.current);
    detectAdState();

    // Fallback: si en 7s no aparece nada, cerrar solos
    const fallbackTimer = window.setTimeout(() => {
      if (!renderableAdDetected) {
        console.warn("Clickadilla tardó demasiado en responder. Activando fallback de seguridad para reproducir el anime.");
        finish();
      }
    }, AD_LOAD_TIMEOUT_MS);

    const emergencySkipTimer = window.setTimeout(() => {
      if (!closed && (!renderableAdDetected || !closeControlDetected)) {
        setShowEmergencySkip(true);
      }
    }, EMERGENCY_SKIP_MS);

    return () => {
      closed = true;
      if (!unloading) clearAdLoadingMarker();
      safe(() => observer.disconnect());
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(emergencySkipTimer);
      window.clearInterval(detectInterval);
      if (closeTimer) window.clearTimeout(closeTimer);
      window.clearInterval(pauseInterval);
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
      if (window._preventAnimePlay === onPlayAttempt) delete window._preventAnimePlay;
      forceSkipRef.current = null;
      // Restaurar iframes/mute si el gate se desmonta con anuncio activo
      removeClickadillaDom();
      releasePlayerBehind(playerBlock, onPlayAttempt);
    };
  }, [show, episodeKey]);

  // Limpieza al salir de /watch
  useEffect(() => {
    return () => {
      removeClickadillaDom();
      const v = getPlayerVideo();
      v?.play().catch(() => undefined);
    };
  }, []);

  if (isPremium || loading) return null;

  return (
    <div
      ref={overlayRef}
      id={OVERLAY_ID}
      aria-hidden={!show}
      className="absolute inset-0 z-[60] flex flex-col items-center justify-center gap-4 p-4 text-center"
      style={{
        display: show ? "flex" : "none",
        // Mientras el ad no aparece: fondo negro con loader.
        // Cuando aparece: totalmente transparente, sin UI propia, solo bloquea el player.
        background: adVisible ? "transparent" : "rgba(0,0,0,0.92)",
        pointerEvents: show ? "auto" : "none",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        ref={adMountRef}
        data-zet-clickadilla-mount="true"
        className="absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: adVisible ? 1 : 0,
          pointerEvents: adVisible ? "auto" : "none",
        }}
      />
      {!adVisible && (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-white">
            Preparando tu función…
          </p>
          <p className="text-xs text-white/70 max-w-[320px] leading-relaxed">
            Los anuncios son los que ayudan a mantener <span className="text-primary font-bold">ZetAnime</span> online y gratis. ¡Gracias por tu apoyo! 🧡
          </p>
        </>
      )}
      {showEmergencySkip && (
        <button
          type="button"
          className="absolute bottom-4 right-4 z-[70] rounded-md border border-border bg-background/95 px-3 py-2 text-xs font-semibold text-foreground shadow-lg"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            forceSkipRef.current?.();
          }}
        >
          ¿El anuncio no carga? Omitir
        </button>
      )}
    </div>
  );
}
