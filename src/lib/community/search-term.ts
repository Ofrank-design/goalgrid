/** Normalises raw search input: trims, collapses whitespace and caps the length. */
export function cleanSearchTerm(raw: string, max = 60): string {
  return raw.replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Builds a contains-pattern for ILIKE from user text. Backslash, % and _ are escaped so they match literally
 * instead of acting as wildcards. The result is passed as a bound filter value, never spliced into a filter string.
 */
export function containsPattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
}
