// Translation utility for synopses
const TRANSLATE_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/translate-text`;

const memoryCache = new Map<string, string>();

export async function translateText(text: string, cacheKey?: string): Promise<string> {
  const clean = text.replace(/<[^>]*>/g, "").trim();
  if (!clean) return "";

  const key = cacheKey || `translate_${clean.slice(0, 50)}`;

  // Memory cache
  if (memoryCache.has(key)) return memoryCache.get(key)!;

  // localStorage cache
  const cached = localStorage.getItem(key);
  if (cached) {
    memoryCache.set(key, cached);
    return cached;
  }

  try {
    const res = await fetch(TRANSLATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean }),
    });
    const data = await res.json();
    if (data.translated) {
      memoryCache.set(key, data.translated);
      localStorage.setItem(key, data.translated);
      return data.translated;
    }
  } catch {}

  return clean;
}
