// VAST video ad overlay (ExoClick / MagSrv).
// - Fetches & parses VAST XML, plays the first MediaFile in an HTML5 <video>.
// - Renders INSIDE the #player-video container (absolute inset-0) — never covers the whole page.
// - Travels into fullscreen automatically because #player-video is the element that goes fullscreen.
// - Pauses ALL other <video> elements while the ad runs (no audio overlap).
// - Frequency: shows after `everyN` episode changes AND >= `cooldownMs` since last impression.
// - Premium users are exempt.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Volume2, VolumeX } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  episodeKey: string;
  vastUrl: string;
  everyN?: number;       // episode changes between ads (default 2)
  cooldownMs?: number;   // min ms between impressions (default 40min)
  skipAfter?: number;    // seconds before user can skip (default 5)
}

const COUNTER_KEY = "zet:vast-ad-counter";
const COOLDOWN_KEY = "zet:vast-ad-last-shown";

function getCounter(): { count: number; lastKey: string } {
  try { return JSON.parse(localStorage.getItem(COUNTER_KEY) || "") || { count: 0, lastKey: "" }; }
  catch { return { count: 0, lastKey: "" }; }
}
function setCounter(v: { count: number; lastKey: string }) {
  try { localStorage.setItem(COUNTER_KEY, JSON.stringify(v)); } catch {}
}
function getLastShown(): number {
  return Number(localStorage.getItem(COOLDOWN_KEY) || 0);
}
function markShown() {
  try { localStorage.setItem(COOLDOWN_KEY, String(Date.now())); } catch {}
}

function getFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement || doc.webkitFullscreenElement || null;
}

interface ParsedVast {
  mediaUrl: string;
  clickThrough?: string;
  impressions: string[];
  clickTracking: string[];
  trackingEvents: Record<string, string[]>;
}

async function fetchAndParseVast(url: string, depth = 0): Promise<ParsedVast | null> {
  if (depth > 3) return null;
  try {
    const cacheBuster = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${cacheBuster}cb=${Date.now()}`, { credentials: "omit" });
    if (!res.ok) return null;
    const xmlText = await res.text();
    const xml = new DOMParser().parseFromString(xmlText, "application/xml");

    // Wrapper -> follow VASTAdTagURI
    const wrapperTag = xml.querySelector("VASTAdTagURI");
    if (wrapperTag?.textContent) {
      return fetchAndParseVast(wrapperTag.textContent.trim(), depth + 1);
    }

    // Inline -> get MediaFile
    const mediaFiles = Array.from(xml.querySelectorAll("MediaFile"));
    if (!mediaFiles.length) return null;
    // Prefer mp4/webm progressive
    const mf =
      mediaFiles.find((m) => /mp4|webm/i.test(m.getAttribute("type") || "")) ||
      mediaFiles[0];
    const mediaUrl = mf.textContent?.trim() || "";
    if (!mediaUrl) return null;

    const clickThrough = xml.querySelector("ClickThrough")?.textContent?.trim() || undefined;
    const impressions = Array.from(xml.querySelectorAll("Impression"))
      .map((n) => n.textContent?.trim() || "")
      .filter(Boolean);
    const clickTracking = Array.from(xml.querySelectorAll("ClickTracking"))
      .map((n) => n.textContent?.trim() || "")
      .filter(Boolean);
    const trackingEvents: Record<string, string[]> = {};
    Array.from(xml.querySelectorAll("Tracking")).forEach((t) => {
      const evt = t.getAttribute("event") || "";
      const u = t.textContent?.trim() || "";
      if (!evt || !u) return;
      (trackingEvents[evt] = trackingEvents[evt] || []).push(u);
    });

    return { mediaUrl, clickThrough, impressions, clickTracking, trackingEvents };
  } catch {
    return null;
  }
}

function pingUrls(urls: string[]) {
  urls.forEach((u) => {
    try { new Image().src = u; } catch {}
  });
}

export default function VastAdOverlay({
  episodeKey,
  vastUrl,
  everyN = 2,
  cooldownMs = 40 * 60 * 1000,
  skipAfter = 5,
}: Props) {
  const { user, roles, isPremium, isOwner, loading } = useAuth();
  const [show, setShow] = useState(false);
  const [vast, setVast] = useState<ParsedVast | null>(null);
  const [error, setError] = useState(false);
  const [secs, setSecs] = useState(skipAfter);
  const [muted, setMuted] = useState(false);
  const [portalEl, setPortalEl] = useState<Element | null>(null);
  const [useFullscreenDialog, setUseFullscreenDialog] = useState(false);
  const [, force] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pausedVideos = useRef<HTMLVideoElement[]>([]);
  const firedEvents = useRef<Set<string>>(new Set());
  const authPending = loading;
  const adsExempt = isPremium || isOwner || roles.includes("premium") || roles.includes("owner");

  useEffect(() => {
    if (!adsExempt) return;
    setShow(false);
    setVast(null);
    setError(false);
  }, [adsExempt]);

  // Decide whether to show on episode change
  useEffect(() => {
    if (authPending || adsExempt || !episodeKey) return;
    const cur = getCounter();
    if (cur.lastKey === episodeKey) return;
    const nextCount = cur.count + 1;
    setCounter({ count: nextCount, lastKey: episodeKey });
    const cooldownOk = Date.now() - getLastShown() >= cooldownMs;
    if (nextCount % everyN === 0 && cooldownOk) {
      setShow(true);
      setError(false);
      setVast(null);
      setSecs(skipAfter);
      firedEvents.current = new Set();
    }
  }, [episodeKey, authPending, adsExempt, everyN, cooldownMs, skipAfter]);

  // Fetch VAST when opened
  useEffect(() => {
    if (!show) return;
    let cancelled = false;
    fetchAndParseVast(vastUrl).then((v) => {
      if (cancelled) return;
      if (!v) { setError(true); setTimeout(() => setShow(false), 1500); return; }
      setVast(v);
      pingUrls(v.impressions);
      markShown();
    });
    return () => { cancelled = true; };
  }, [show, vastUrl]);

  // Pause every other <video> while the ad is shown; restore when closed
  useEffect(() => {
    if (!show) return;
    const all = Array.from(document.querySelectorAll("video"));
    const toPause = all.filter((v) => v !== videoRef.current && !v.paused);
    toPause.forEach((v) => { try { v.pause(); } catch {} });
    pausedVideos.current = toPause;
    return () => {
      pausedVideos.current.forEach((v) => { try { v.play().catch(() => {}); } catch {} });
      pausedVideos.current = [];
    };
  }, [show, vast]);

  // Portal target: prefer the active fullscreen player surface when needed;
  // otherwise render inside #player-video so it stays contained in normal mode.
  useEffect(() => {
    if (!show) return;
    const find = () => {
      const playerEl = document.getElementById("player-video");
      const fullscreenEl = getFullscreenElement();
      if (isReplacedFullscreenElement(fullscreenEl)) {
        setPortalEl(fullscreenEl);
        return;
      }
      setPortalEl(playerEl || fullscreenEl || null);
    };
    find();
    const onFsChange = () => {
      const playerEl = document.getElementById("player-video");
      const fullscreenEl = getFullscreenElement();
      if (playerEl && isReplacedFullscreenElement(fullscreenEl)) {
        void switchFullscreenToPlayer(playerEl);
      }
      find();
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as EventListener);
    // Retry briefly in case the player mounts a tick later
    const t1 = setTimeout(find, 100);
    const t2 = setTimeout(find, 500);
    const t3 = setTimeout(onFsChange, 900);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as EventListener);
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [show]);

  // Skip countdown
  useEffect(() => {
    if (!show || !vast || secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [show, vast, secs]);

  if (authPending || adsExempt || !show) return null;

  const fireOnce = (evt: string) => {
    if (firedEvents.current.has(evt)) return;
    firedEvents.current.add(evt);
    pingUrls(vast?.trackingEvents[evt] || []);
  };

  const closeAd = () => {
    setShow(false);
    setVast(null);
  };

  const handleClick = () => {
    if (!vast?.clickThrough) return;
    pingUrls(vast.clickTracking);
    window.open(vast.clickThrough, "_blank", "noopener,noreferrer");
  };

  const canSkip = secs <= 0;
  const portalIsMediaElement = isReplacedFullscreenElement(portalEl);

  const node = (
    <div
      className={`${portalIsMediaElement ? "fixed" : "absolute"} inset-0 z-[2147483647] bg-black flex items-center justify-center`}
      onClick={(e) => e.stopPropagation()}
    >
      {!vast && !error && (
        <div className="flex flex-col items-center gap-3 text-white/70">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="text-xs">Cargando anuncio…</span>
        </div>
      )}

      {error && (
        <div className="text-white/60 text-xs">No se pudo cargar el anuncio</div>
      )}

      {vast && (
        <>
          <video
            ref={videoRef}
            src={vast.mediaUrl}
            autoPlay
            playsInline
            muted={muted}
            className="max-w-full max-h-full w-auto h-full cursor-pointer"
            onClick={handleClick}
            onPlay={() => fireOnce("start")}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (!v.duration) return;
              const p = v.currentTime / v.duration;
              if (p >= 0.25) fireOnce("firstQuartile");
              if (p >= 0.5)  fireOnce("midpoint");
              if (p >= 0.75) fireOnce("thirdQuartile");
            }}
            onEnded={() => { fireOnce("complete"); closeAd(); }}
            onError={() => { setError(true); setTimeout(closeAd, 1500); }}
          />

          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 p-2 sm:p-3 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent pointer-events-none">
            <span className="text-[10px] uppercase tracking-widest text-white/70 bg-black/40 px-2 py-1 rounded">
              Publicidad
            </span>
            <button
              onClick={() => { setMuted((m) => !m); force((n) => n + 1); }}
              className="pointer-events-auto w-9 h-9 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center"
              aria-label={muted ? "Activar sonido" : "Silenciar"}
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>

          {/* Skip / countdown */}
          <button
            onClick={canSkip ? closeAd : undefined}
            disabled={!canSkip}
            className={`absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              canSkip
                ? "bg-white text-black hover:scale-105"
                : "bg-black/60 text-white/70 cursor-not-allowed"
            }`}
          >
            {canSkip ? (<><X className="w-3.5 h-3.5" />Saltar anuncio</>) : (`Saltar en ${secs}s`)}
          </button>
        </>
      )}
    </div>
  );

  // Only render when we have a player/fullscreen target.
  return portalEl ? createPortal(node, portalEl) : null;
}
