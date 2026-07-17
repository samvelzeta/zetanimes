// Gate de anuncios Clickadilla (Anti-Adblock) sobre el player.
//
// Flujo simplificado:
//   1) Al gatillar un anuncio, pausamos el <video> y montamos una capa
//      absoluta dentro de #zet-player-container con un mensaje de carga
//      ("Cargando anuncio que ayuda a mantener ZetAnime online...").
//   2) Inyectamos el script Clickadilla. Un MutationObserver detecta cuando
//      Clickadilla pinta su overlay (iframe/elemento wpadmngr). En cuanto
//      aparece, ocultamos nuestro loader (dejamos que Clickadilla domine la
//      pantalla). No mostramos ningún botón/mensaje propio adicional.
//   3) Cuando Clickadilla remueve su overlay (usuario lo cierra), detectamos
//      la salida y reanudamos el video automáticamente.
//   4) Fallback: si el anuncio no llega en 10s, auto-cerramos y reanudamos.
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
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const SCRIPT_MARK = "data-zet-clickadilla-ad";
const OVERLAY_ID = "zet-clickadilla-overlay-host";
const AD_LOAD_TIMEOUT_MS = 10_000;

// Script Clickadilla Anti-Adblock (sin modificar)
const CLICKADILLA_SCRIPT_SRC = `function R(K,h){var O=X();return R=function(p,E){p=p-0x87;var Z=O[p];return Z;},R(K,h);}(function(K,h){var Xo=R,O=K();while(!![]){try{var p=parseInt(Xo(0xac))/0x1*(-parseInt(Xo(0x90))/0x2)+parseInt(Xo(0xa5))/0x3*(-parseInt(Xo(0x8d))/0x4)+parseInt(Xo(0xb5))/0x5*(-parseInt(Xo(0x93))/0x6)+parseInt(Xo(0x89))/0x7+-parseInt(Xo(0xa1))/0x8+parseInt(Xo(0xa7))/0x9*(parseInt(Xo(0xb2))/0xa)+parseInt(Xo(0x95))/0xb*(parseInt(Xo(0x9f))/0xc);if(p===h)break;else O['push'](O['shift']());}catch(E){O['push'](O['shift']());}}}(X,0x33565),(function(){var XG=R;function K(){var Xe=R,h=448333,O='a3klsam',p='a',E='db',Z=Xe(0xad),S=Xe(0xb6),o=Xe(0xb0),e='cs',D='k',c='pro',u='xy',Q='su',G=Xe(0x9a),j='se',C='cr',z='et',w='sta',Y='tic',g='adMa',V='nager',A=p+E+Z+S+o,s=p+E+Z+S+e,W=p+E+Z+D+'-'+c+u+'-'+Q+G+'-'+j+C+z,L='/'+w+Y+'/'+g+V+Xe(0x9c),T=A,t=s,I=W,N=null,r=null,n=new Date()[Xe(0x94)]()[Xe(0x8c)]('T')[0x0][Xe(0xa3)](/-/ig,'.')['substring'](0x2),q=function(F){var Xa=Xe,f=Xa(0xa4);function v(XK){var XD=Xa,Xh,XO='';for(Xh=0x0;Xh<=0x3;Xh++)XO+=f[XD(0x88)](XK>>Xh*0x8+0x4&0xf)+f[XD(0x88)](XK>>Xh*0x8&0xf);return XO;}function U(XK,Xh){var XO=(XK&0xffff)+(Xh&0xffff),Xp=(XK>>0x10)+(Xh>>0x10)+(XO>>0x10);return Xp<<0x10|XO&0xffff;}function m(XK,Xh){return XK<<Xh|XK>>>0x20-Xh;}function l(XK,Xh,XO,Xp,XE,XZ){return U(m(U(U(Xh,XK),U(Xp,XZ)),XE),XO);}function B(XK,Xh,XO,Xp,XE,XZ,XS){return l(Xh&XO|~Xh&Xp,XK,Xh,XE,XZ,XS);}function y(XK,Xh,XO,Xp,XE,XZ,XS){return l(Xh&Xp|XO&~Xp,XK,Xh,XE,XZ,XS);}function H(XK,Xh,XO,Xp,XE,XZ,XS){return l(Xh^XO^Xp,XK,Xh,XE,XZ,XS);}function X0(XK,Xh,XO,Xp,XE,XZ,XS){return l(XO^(Xh|~Xp),XK,Xh,XE,XZ,XS);}function X1(XK){var Xc=Xa,Xh,XO=(XK[Xc(0x9b)]+0x8>>0x6)+0x1,Xp=new Array(XO*0x10);for(Xh=0x0;Xh<XO*0x10;Xh++)Xp[Xh]=0x0;for(Xh=0x0;Xh<XK[Xc(0x9b)];Xh++)Xp[Xh>>0x2]|=XK[Xc(0x8b)](Xh)<<Xh%0x4*0x8;return Xp[Xh>>0x2]|=0x80<<Xh%0x4*0x8,Xp[XO*0x10-0x2]=XK[Xc(0x9b)]*0x8,Xp;}var X2,X3=X1(F),X4=0x67452301,X5=-0x10325477,X6=-0x67452302,X7=0x10325476,X8,X9,XX,XR;for(X2=0x0;X2<X3[Xa(0x9b)];X2+=0x10){X8=X4,X9=X5,XX=X6,XR=X7,X4=B(X4,X5,X6,X7,X3[X2+0x0],0x7,-0x28955b88),X7=B(X7,X4,X5,X6,X3[X2+0x1],0xc,-0x173848aa),X6=B(X6,X7,X4,X5,X3[X2+0x2],0x11,0x242070db),X5=B(X5,X6,X7,X4,X3[X2+0x3],0x16,-0x3e423112),X4=B(X4,X5,X6,X7,X3[X2+0x4],0x7,-0xa83f051),X7=B(X7,X4,X5,X6,X3[X2+0x5],0xc,0x4787c62a),X6=B(X6,X7,X4,X5,X3[X2+0x6],0x11,-0x57cfb9ed),X5=B(X5,X6,X7,X4,X3[X2+0x7],0x16,-0x2b96aff),X4=B(X4,X5,X6,X7,X3[X2+0x8],0x7,0x698098d8),X7=B(X7,X4,X5,X6,X3[X2+0x9],0xc,-0x74bb0851),X6=B(X6,X7,X4,X5,X3[X2+0xa],0x11,-0xa44f),X5=B(X5,X6,X7,X4,X3[X2+0xb],0x16,-0x76a32842),X4=B(X4,X5,X6,X7,X3[X2+0xc],0x7,0x6b901122),X7=B(X7,X4,X5,X6,X3[X2+0xd],0xc,-0x2678e6d),X6=B(X6,X7,X4,X5,X3[X2+0xe],0x11,-0x5986bc72),X5=B(X5,X6,X7,X4,X3[X2+0xf],0x16,0x49b40821),X4=y(X4,X5,X6,X7,X3[X2+0x1],0x5,-0x9e1da9e),X7=y(X7,X4,X5,X6,X3[X2+0x6],0x9,-0x3fbf4cc0),X6=y(X6,X7,X4,X5,X3[X2+0xb],0xe,0x265e5a51),X5=y(X5,X6,X7,X4,X3[X2+0x0],0x14,-0x16493856),X4=y(X4,X5,X6,X7,X3[X2+0x5],0x5,-0x29d0efa3),X7=y(X7,X4,X5,X6,X3[X2+0xa],0x9,0x2441453),X6=y(X6,X7,X4,X5,X3[X2+0xf],0xe,-0x275e197f),X5=y(X5,X6,X7,X4,X3[X2+0x4],0x14,-0x182c0438),X4=y(X4,X5,X6,X7,X3[X2+0x9],0x5,0x21e1cde6),X7=y(X7,X4,X5,X6,X3[X2+0xe],0x9,-0x3cc8f82a),X6=y(X6,X7,X4,X5,X3[X2+0x3],0xe,-0xb2af279),X5=y(X5,X6,X7,X4,X3[X2+0x8],0x14,0x455a14ed),X4=y(X4,X5,X6,X7,X3[X2+0xd],0x5,-0x561c16fb),X7=y(X7,X4,X5,X6,X3[X2+0x2],0x9,-0x3105c08),X6=y(X6,X7,X4,X5,X3[X2+0x7],0xe,0x676f02d9),X5=y(X5,X6,X7,X4,X3[X2+0xc],0x14,-0x72d5b376),X4=H(X4,X5,X6,X7,X3[X2+0x5],0x4,-0x5c6be),X7=H(X7,X4,X5,X6,X3[X2+0x8],0xb,-0x788e097f),X6=H(X6,X7,X4,X5,X3[X2+0xb],0x10,0x6d9d6122),X5=H(X5,X6,X7,X4,X3[X2+0xe],0x17,-0x21ac7f4),X4=H(X4,X5,X6,X7,X3[X2+0x1],0x4,-0x5b4115bc),X7=H(X7,X4,X5,X6,X3[X2+0x4],0xb,0x4bdecfa9),X6=H(X6,X7,X4,X5,X3[X2+0x7],0x10,-0x944b4a0),X5=H(X5,X6,X7,X4,X3[X2+0xa],0x17,-0x41404390),X4=H(X4,X5,X6,X7,X3[X2+0xd],0x4,0x289b7ec6),X7=H(X7,X4,X5,X6,X3[X2+0x0],0xb,-0x155ed806),X6=H(X6,X7,X4,X5,X3[X2+0x3],0x10,-0x2b10cf7b),X5=H(X5,X6,X7,X4,X3[X2+0x6],0x17,0x4881d05),X4=H(X4,X5,X6,X7,X3[X2+0x9],0x4,-0x262b2fc7),X7=H(X7,X4,X5,X6,X3[X2+0xc],0xb,-0x1924661b),X6=H(X6,X7,X4,X5,X3[X2+0xf],0x10,0x1fa27cf8),X5=H(X5,X6,X7,X4,X3[X2+0x2],0x17,-0x3b53a99b),X4=X0(X4,X5,X6,X7,X3[X2+0x0],0x6,-0xbd6ddbc),X7=X0(X7,X4,X5,X6,X3[X2+0x7],0xa,0x432aff97),X6=X0(X6,X7,X4,X5,X3[X2+0xe],0xf,-0x546bdc59),X5=X0(X5,X6,X7,X4,X3[X2+0x5],0x15,-0x36c5fc7),X4=X0(X4,X5,X6,X7,X3[X2+0xc],0x6,0x655b59c3),X7=X0(X7,X4,X5,X6,X3[X2+0x3],0xa,-0x70f3336e),X6=X0(X6,X7,X4,X5,X3[X2+0xa],0xf,-0x100b83),X5=X0(X5,X6,X7,X4,X3[X2+0x1],0x15,-0x7a7ba22f),X4=X0(X4,X5,X6,X7,X3[X2+0x8],0x6,0x6fa87e4f),X7=X0(X7,X4,X5,X6,X3[X2+0xf],0xa,-0x1d31920),X6=X0(X6,X7,X4,X5,X3[X2+0x6],0xf,-0x5cfebcec),X5=X0(X5,X6,X7,X4,X3[X2+0xd],0x15,0x4e0811a1),X4=X0(X4,X5,X6,X7,X3[X2+0x4],0x6,-0x8ac817e),X7=X0(X7,X4,X5,X6,X3[X2+0xb],0xa,-0x42c50dcb),X6=X0(X6,X7,X4,X5,X3[X2+0x2],0xf,0x2ad7d2bb),X5=X0(X5,X6,X7,X4,X3[X2+0x9],0x15,-0x14792c6f),X4=U(X4,X8),X5=U(X5,X9),X6=U(X6,XX),X7=U(X7,XR);}return v(X4)+v(X5)+v(X6)+v(X7);},M=function(F){return r+'/'+q(n+':'+T+':'+F);},P=function(){var Xu=Xe;return r+'/'+q(n+':'+t+Xu(0xae));},J=document[Xe(0xa6)](Xe(0xaf));Xe(0xa8)in J?(L=L[Xe(0xa3)]('.js',Xe(0x9d)),J[Xe(0x91)]='module'):(L=L[Xe(0xa3)](Xe(0x9c),Xe(0xb4)),J[Xe(0xb3)]=!![]),N=q(n+':'+I+':domain')[Xe(0xa9)](0x0,0xa)+Xe(0x8a),r=Xe(0x92)+q(N+':'+I)[Xe(0xa9)](0x0,0xa)+'.'+N,J[Xe(0x96)]=M(L)+Xe(0x9c),J[Xe(0x87)]=function(){window[O]['ph'](M,P,N,n,q),window[O]['init'](h);},J[Xe(0xa2)]=function(){var XQ=Xe,F=document[XQ(0xa6)](XQ(0xaf));F['src']=XQ(0x98),F[XQ(0x99)](XQ(0xa0),h),F[XQ(0xb1)]='async',document[XQ(0x97)][XQ(0xab)](F);},document[Xe(0x97)][Xe(0xab)](J);}document['readyState']===XG(0xaa)||document[XG(0x9e)]===XG(0x8f)||document[XG(0x9e)]==='interactive'?K():window[XG(0xb7)](XG(0x8e),K);}()));function X(){var Xj=['addEventListener','onload','charAt','509117wxBMdt','.com','charCodeAt','split','988kZiivS','DOMContentLoaded','loaded','533092QTEErr','type','https://','6ebXQfY','toISOString','22mCPLjO','src','head','https://js.wpadmngr.com/static/adManager.js','setAttribute','per','length','.js','.m.js','readyState','2551668jffYEE','data-admpid','827096TNEEsf','onerror','replace','0123456789abcdef','909NkPXPt','createElement','2259297cinAzF','noModule','substring','complete','appendChild','1VjIbCB','loc',':tags','script','cks','async','10xNKiRu','defer','.l.js','469955xpTljk','ksu'];X=function(){return Xj;};return X();}`;

function removeInjected() {
  document.querySelectorAll(`script[${SCRIPT_MARK}]`).forEach((n) => n.parentNode?.removeChild(n));
}

function getPlayerVideo(): HTMLVideoElement | null {
  return document.querySelector<HTMLVideoElement>("#zet-player-container video");
}

function getPlayerIframes(): HTMLIFrameElement[] {
  return Array.from(document.querySelectorAll<HTMLIFrameElement>("#zet-player-container iframe"));
}

interface MutedState {
  video?: { muted: boolean; volume: number };
  iframes: Array<{ el: HTMLIFrameElement; src: string }>;
}

function silenceBehind(state: MutedState) {
  const v = getPlayerVideo();
  if (v) {
    try { v.pause(); } catch {}
    if (state.video === undefined) {
      state.video = { muted: v.muted, volume: v.volume };
    }
    v.muted = true;
    v.volume = 0;
  }
  // Iframes de players externos: no podemos pause() → blankear su src corta el audio
  const iframes = getPlayerIframes();
  for (const f of iframes) {
    if (state.iframes.find((x) => x.el === f)) continue;
    const src = f.src;
    if (!src || src === "about:blank") continue;
    state.iframes.push({ el: f, src });
    try { f.src = "about:blank"; } catch {}
  }
}

function restoreBehind(state: MutedState) {
  const v = getPlayerVideo();
  if (v && state.video) {
    v.muted = state.video.muted;
    v.volume = state.video.volume;
    v.play().catch(() => undefined);
  }
  for (const { el, src } of state.iframes) {
    try { el.src = src; } catch {}
  }
  state.iframes = [];
  state.video = undefined;
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
  const tag = node.tagName;
  if (tag === "IFRAME") {
    const src = (node as HTMLIFrameElement).src || "";
    if (/wpadmngr|clickadilla|adsco\.re|admngr/i.test(src)) return true;
  }
  const id = node.id || "";
  const cls = typeof node.className === "string" ? node.className : "";
  if (/adm|clickadilla|wpadmngr|admngr/i.test(id + " " + cls)) return true;
  if (node.querySelector?.('iframe[src*="wpadmngr"], iframe[src*="clickadilla"]')) return true;
  return false;
}

export default function ClickadillaAdGate({ episodeKey }: Props) {
  const { isPremium, loading } = useAuth();
  const processedKeyRef = useRef<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [show, setShow] = useState(false);
  const [adVisible, setAdVisible] = useState(false); // Clickadilla ya está pintando

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

    const shouldShowAd = counter % 2 === 0;

    if (shouldShowAd) {
      setShow(true);
      setAdVisible(false);
    } else {
      setShow(false);
      removeInjected();
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
    let trackedNode: HTMLElement | null = null;
    let attachedVideo: HTMLVideoElement | null = null;

    const forcePause = () => {
      const v = getPlayerVideo();
      if (!v) return;
      try {
        v.pause();
        // Marca visual + prevención de autoplay HLS.js posterior
        (v as any).__zetAdBlocked = true;
      } catch {}
    };

    const onPlayAttempt = () => {
      // Cualquier intento de play mientras el anuncio está activo se cancela
      forcePause();
    };

    const attachTo = (v: HTMLVideoElement) => {
      if (attachedVideo === v) return;
      // Despega del anterior
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", onPlayAttempt);
        attachedVideo.removeEventListener("playing", onPlayAttempt);
        attachedVideo.removeEventListener("loadeddata", onPlayAttempt);
        attachedVideo.removeEventListener("canplay", onPlayAttempt);
      }
      attachedVideo = v;
      v.addEventListener("play", onPlayAttempt);
      v.addEventListener("playing", onPlayAttempt);
      v.addEventListener("loadeddata", onPlayAttempt);
      v.addEventListener("canplay", onPlayAttempt);
    };

    // Poll agresivo: el <video> puede no existir todavía (HLS.js monta después)
    // Mantiene el video pausado durante toda la vida del anuncio.
    const pauseInterval = window.setInterval(() => {
      const v = getPlayerVideo();
      if (v) {
        attachTo(v);
        if (!v.paused) forcePause();
      }
    }, 150);

    forcePause();
    const initialVideo = getPlayerVideo();
    if (initialVideo) attachTo(initialVideo);

    const finish = () => {
      if (closed) return;
      closed = true;
      setShow(false);
      setAdVisible(false);
      removeInjected();
      try { observer.disconnect(); } catch {}
      try { exitObserver?.disconnect(); } catch {}
      window.clearTimeout(fallbackTimer);
      window.clearInterval(pauseInterval);
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", onPlayAttempt);
        attachedVideo.removeEventListener("playing", onPlayAttempt);
        attachedVideo.removeEventListener("loadeddata", onPlayAttempt);
        attachedVideo.removeEventListener("canplay", onPlayAttempt);
        (attachedVideo as any).__zetAdBlocked = false;
      }
      // Reanuda el video tras cerrar el anuncio
      window.setTimeout(() => {
        const vv = getPlayerVideo();
        vv?.play().catch(() => undefined);
      }, 50);
    };

    let exitObserver: MutationObserver | null = null;

    // Observa apariciones de nodos Clickadilla en el body
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (isClickadillaNode(n)) {
            trackedNode = n as HTMLElement;
            setAdVisible(true);
            console.info("[zetAds] Overlay Clickadilla detectado");
            observer.disconnect();

            // Observa cuándo se remueve para reanudar el video
            exitObserver = new MutationObserver(() => {
              if (trackedNode && !document.body.contains(trackedNode)) {
                console.info("[zetAds] Overlay Clickadilla cerrado por el usuario");
                finish();
              }
            });
            exitObserver.observe(document.body, { childList: true, subtree: true });
            return;
          }
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Inyecta en el host del overlay
    if (overlayRef.current) injectClickadilla(overlayRef.current);

    // Fallback: si en 10s no aparece nada, cerrar solos
    const fallbackTimer = window.setTimeout(() => {
      if (!adVisible) {
        console.warn("[zetAds] Anuncio no cargó en tiempo, continuando…");
        finish();
      }
    }, AD_LOAD_TIMEOUT_MS);

    return () => {
      closed = true;
      try { observer.disconnect(); } catch {}
      try { exitObserver?.disconnect(); } catch {}
      window.clearTimeout(fallbackTimer);
      window.clearInterval(pauseInterval);
      if (attachedVideo) {
        attachedVideo.removeEventListener("play", onPlayAttempt);
        attachedVideo.removeEventListener("playing", onPlayAttempt);
        attachedVideo.removeEventListener("loadeddata", onPlayAttempt);
        attachedVideo.removeEventListener("canplay", onPlayAttempt);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  // Limpieza al salir de /watch
  useEffect(() => {
    return () => {
      removeInjected();
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
      {!adVisible && (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-white">
            Cargando anuncio…
          </p>
          <p className="text-xs text-white/70 max-w-[320px] leading-relaxed">
            Los anuncios son los que ayudan a mantener <span className="text-primary font-bold">ZetAnime</span> online y gratis. ¡Gracias por tu apoyo! 🧡
          </p>
        </>
      )}
    </div>
  );
}
