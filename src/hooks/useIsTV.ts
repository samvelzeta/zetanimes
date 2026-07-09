// TV mode detection hook
import { useState, useEffect } from "react";

export function isTV(): boolean {
  if (typeof window === "undefined") return false;

  // Manual override (user preference)
  try {
    const override = localStorage.getItem("zet:device-mode");
    if (override === "tv") return true;
    if (override === "pc" || override === "desktop" || override === "mobile") return false;
  } catch {}

  const ua = navigator.userAgent || "";

  // 1) Explicit TV / consola user agents (señal fuerte)
  if (/SmartTV|Smart-TV|SMART-TV|GoogleTV|Tizen|webOS|Web0S|BRAVIA|AFTT|AFTM|FireTV|Roku|AppleTV|tvOS|CrKey|Vizio|NetCast|Hisense TV|Philips TV|PlayStation|Xbox/i.test(ua)) return true;

  // 2) Android TV (Android + marcador TV / dispositivos conocidos)
  if (/Android/i.test(ua) && /(\bTV\b|MIBOX|Shield|BRAVIA|AFT[A-Z]{1,3})/.test(ua)) return true;

  // NOTA: NO usar resolución de pantalla como señal de TV.
  // Muchos PCs tienen monitores 1080p/1440p/4K y estaban siendo detectados
  // erróneamente como TV. Un PC de escritorio con monitor grande sigue siendo PC.
  // La detección real de TV depende del user agent del dispositivo.

  return false;
}

export function useIsTV() {
  const [tv, setTv] = useState(false);
  useEffect(() => { setTv(isTV()); }, []);
  return tv;
}
