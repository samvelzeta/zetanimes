// TV mode detection hook
import { useState, useEffect } from "react";

export function isTV(): boolean {
  if (typeof window === "undefined") return false;
  const ua = navigator.userAgent || "";
  // Smart TV, Android TV, webOS, Tizen, large screens
  if (/SmartTV|Smart-TV|SMART-TV|GoogleTV|Tizen|webOS|Web0S|BRAVIA|AFTT|AFTM|FireTV|Roku|AppleTV|tvOS|CrKey|Vizio|LG Browser|NetCast|Hisense|Philips|PlayStation|Xbox/i.test(ua)) return true;
  // Android TV
  if (/Android/.test(ua) && /TV|MIBOX|Shield/i.test(ua)) return true;
  // Very large screen (TV typically 1920+ wide, 1080+ tall) and not touch
  if (window.screen.width >= 1920 && window.screen.height >= 1000) {
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (!isTouch) return true;
  }
  return false;
}

export function useIsTV() {
  const [tv, setTv] = useState(false);
  useEffect(() => { setTv(isTV()); }, []);
  return tv;
}
