// Device fingerprint estable por navegador / APK
const KEY = "zet:device-id";

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getDeviceInfo() {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isTV = /TV|SmartTV|GoogleTV|AppleTV|Tizen|WebOS|BRAVIA/i.test(ua);
  const isAPK = /wv|; wv\)/i.test(ua) || (window as any).AndroidWebView !== undefined;

  let platform = "Web";
  if (isTV) platform = "Smart TV";
  else if (isAPK) platform = "APK";
  else if (isAndroid) platform = "Android";
  else if (isIOS) platform = "iOS";
  else if (/Windows/i.test(ua)) platform = "Windows";
  else if (/Mac/i.test(ua)) platform = "Mac";
  else if (/Linux/i.test(ua)) platform = "Linux";

  let browser = "Navegador";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/Chrome/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua)) browser = "Safari";

  return {
    deviceId: getDeviceId(),
    platform,
    deviceName: `${browser} en ${platform}`,
    userAgent: ua.slice(0, 250),
  };
}
