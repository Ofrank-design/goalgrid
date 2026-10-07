export type Tok = { t: "text"; v: string } | { t: "link"; v: string; href: string };
/** Splits "text [label](href) text" into tokens, so page copy can carry links without raw HTML. */
export function tokenize(s: string): Tok[] {
  const out: Tok[] = [], re = /\[([^\]]+)\]\(([^)\s]+)\)/g; let i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(s))) { if (m.index > i) out.push({ t: "text", v: s.slice(i, m.index) }); out.push({ t: "link", v: m[1], href: m[2] }); i = m.index + m[0].length; }
  if (i < s.length) out.push({ t: "text", v: s.slice(i) }); return out;
}
export const isExternal = (href: string) => /^https?:\/\//.test(href);
