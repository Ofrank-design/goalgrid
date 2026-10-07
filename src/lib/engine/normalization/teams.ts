const WORDS_TO_DROP = new Set([
  "fc",
  "cf",
  "afc",
  "ssc",
  "ac",
  "as",
  "sc",
  "ss",
  "us",
  "rc",
  "cd",
  "sv",
  "vfl",
  "vfb",
  "tsg",
  "fk",
  "club",
  "de",
  "the",
  "1",
  "and",
]);

const TEAM_ALIASES: Record<string, string> = {
  "internazionale milano": "inter",
  internazionale: "inter",
  "bayern munchen": "bayern munich",
  "olympique marseille": "marseille",
  "olympique lyonnais": "lyon",
  "paris saint germain": "psg",
  "manchester united": "man united",
  "manchester city": "man city",
  "borussia dortmund": "dortmund",
  "rb leipzig": "leipzig",
  "bayer leverkusen": "leverkusen",
};

/**
 * Reduce provider-specific club names to one stable GoalGrid slug. This keeps
 * the same club connected when a provider adds prefixes, abbreviations or
 * accents to its display name.
 */
export function teamSlug(name: string): string {
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word && !WORDS_TO_DROP.has(word))
    .join(" ");

  return (TEAM_ALIASES[normalized] ?? normalized).replace(/\s+/g, "-");
}
