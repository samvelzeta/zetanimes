// Números: mapeo bidireccional para que "naruto 2" y "naruto dos" empaten.
// Cubrimos 0-10 en español, inglés y romaji japonés (los más comunes en títulos).
const NUM_ALIASES: Record<string, string[]> = {
  "0": ["cero", "zero", "rei"],
  "1": ["uno", "one", "ichi", "i"],
  "2": ["dos", "two", "ni", "ii"],
  "3": ["tres", "three", "san", "iii"],
  "4": ["cuatro", "four", "yon", "shi", "iv"],
  "5": ["cinco", "five", "go", "v"],
  "6": ["seis", "six", "roku", "vi"],
  "7": ["siete", "seven", "shichi", "nana", "vii"],
  "8": ["ocho", "eight", "hachi", "viii"],
  "9": ["nueve", "nine", "kyuu", "ku", "ix"],
  "10": ["diez", "ten", "juu", "x"],
};

// Índice inverso: palabra → dígito canónico.
const WORD_TO_DIGIT: Record<string, string> = Object.entries(NUM_ALIASES).reduce(
  (acc, [digit, words]) => {
    for (const w of words) acc[w] = digit;
    return acc;
  },
  {} as Record<string, string>,
);

/**
 * Expande cada token para que dígitos y palabras numéricas sean intercambiables.
 * "naruto 2" → "naruto 2 dos two ni ii" y "naruto dos" → "naruto dos 2".
 * Se aplica al texto YA normalizado (sin acentos, minúsculas).
 */
function expandNumberTokens(text: string): string {
  if (!text) return text;
  const parts = text.split(" ");
  const out: string[] = [];
  for (const p of parts) {
    out.push(p);
    if (!p) continue;
    if (/^\d{1,2}$/.test(p) && NUM_ALIASES[p]) {
      out.push(...NUM_ALIASES[p]);
    } else if (WORD_TO_DIGIT[p]) {
      const d = WORD_TO_DIGIT[p];
      out.push(d);
      // añadimos también los otros alias del mismo dígito → "dos" también empata "two", "ni"
      for (const alt of NUM_ALIASES[d] || []) if (alt !== p) out.push(alt);
    }
  }
  return out.join(" ");
}

export function normalizeSearchText(value: string): string {
  const base = (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return expandNumberTokens(base);
}


export function searchTokens(value: string): string[] {
  return normalizeSearchText(value)
    .split(" ")
    .filter((token) => token.length >= 2);
}

function bigrams(value: string): Set<string> {
  const compact = normalizeSearchText(value).replace(/\s+/g, "");
  const set = new Set<string>();
  if (compact.length <= 1) {
    if (compact) set.add(compact);
    return set;
  }
  for (let i = 0; i < compact.length - 1; i += 1) set.add(compact.slice(i, i + 2));
  return set;
}

export function diceCoefficient(a: string, b: string): number {
  const left = bigrams(a);
  const right = bigrams(b);
  if (!left.size || !right.size) return 0;
  let overlap = 0;
  left.forEach((gram) => {
    if (right.has(gram)) overlap += 1;
  });
  return (2 * overlap) / (left.size + right.size);
}

function acronym(value: string): string {
  return normalizeSearchText(value)
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("");
}

export function fuzzyTextScore(query: string, candidates: Array<string | null | undefined>): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const tokens = searchTokens(q);
  let best = 0;

  for (const raw of candidates) {
    const text = normalizeSearchText(raw || "");
    if (!text) continue;
    let score = 0;

    if (text === q) score += 8;
    if (text.startsWith(q)) score += 4;
    if (text.includes(q)) score += 3;
    if (acronym(text) === q) score += 3;

    const words = text.split(" ").filter(Boolean);
    if (tokens.length > 0) {
      let hits = 0;
      for (const token of tokens) {
        if (text.includes(token)) hits += 1;
        else if (token.length >= 3 && words.some((word) => word.startsWith(token))) hits += 0.9;
        else if (token.length >= 3 && words.some((word) => word.includes(token))) hits += 0.75;
        else if (token.length >= 3 && words.some((word) => diceCoefficient(word, token) >= 0.6)) hits += 0.7;
        else if (token.length >= 4 && diceCoefficient(text, token) >= 0.32) hits += 0.45;
      }
      score += (hits / tokens.length) * 4;
    }

    score += diceCoefficient(text, q) * 3;
    best = Math.max(best, score);
  }

  return best;
}

export function buildLooseSearchVariants(term: string, max = 7): string[] {
  const original = (term || "").trim();
  const normalized = normalizeSearchText(original);
  const tokens = searchTokens(normalized);
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (value: string) => {
    const clean = value.trim();
    const key = normalizeSearchText(clean);
    if (key.length < 2 || seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  add(original);
  add(normalized);
  if (tokens.length > 1) {
    add(tokens.join(" "));
    add(tokens.slice(0, 3).join(" "));
    add(tokens.slice(0, 2).join(" "));
  }
  tokens.forEach(add);

  const first = tokens[0] || normalized;
  if (first.length >= 3) add(first.slice(0, 3));
  if (first.length >= 4) add(first.slice(0, 4));
  if (normalized.replace(/\s/g, "").length >= 4) add(normalized.replace(/\s/g, "").slice(0, 4));

  return out.slice(0, max);
}