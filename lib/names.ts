const LOWERCASE_PARTICLES = new Set(["de", "del", "la", "van", "von"]);

function formatWord(word: string): string {
  if (!word) return word;
  return word
    .split("-")
    .map((part, index) => {
      if (index > 0 && LOWERCASE_PARTICLES.has(part.toLowerCase())) return part.toLowerCase();
      return part.charAt(0).toLocaleUpperCase("ro-RO") + part.slice(1).toLocaleLowerCase("ro-RO");
    })
    .join("-");
}

function isUpperNameToken(token: string): boolean {
  const letters = token.replace(/[^\p{L}]/gu, "");
  return letters.length > 1 && letters === letters.toLocaleUpperCase("ro-RO");
}

export function formatPersonName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  if (!normalized) return normalized;

  return normalized
    .split(" ")
    .map((token) => (isUpperNameToken(token) ? formatWord(token) : token))
    .join(" ");
}
