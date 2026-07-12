export function normalizeSearchText(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
        else if (token.length >= 3 && words.some((word) => word.startsWith(token))) hits += 0.85;
        else if (token.length >= 4 && words.some((word) => diceCoefficient(word, token) >= 0.72)) hits += 0.65;
        else if (token.length >= 4 && diceCoefficient(text, token) >= 0.42) hits += 0.35;
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