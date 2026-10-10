import { leagueEntry } from "@/lib/football/league-registry";
export function LeagueBadge({ slug, size = 44 }: { slug: string; size?: number }) {
  const entry = leagueEntry(slug);
  // Only the original five have a badge image; every other competition shows its initials.
  if (!entry?.image) return <span className="lgtile" style={{ width: size, height: size, fontSize: Math.round(size / 3.2), fontWeight: 800 }} aria-hidden="true">{(entry?.name ?? slug).split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase()}</span>;
  return <span className="lgtile" style={{ width: size, height: size }}><img src={`/leagues/${slug}.webp`} alt="" width={size - 14} height={size - 14} /></span>;
}
const C: Record<string, string> = { W: "#00e676", D: "#9fb2b8", L: "#ff5d5d" };
export function FormChips({ form }: { form: ("W" | "D" | "L")[] }) {
  return <span className="chips" style={{ gap: 4 }} aria-label={`Recent form: ${form.join(" ")}`}>{form.map((f, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#04210f", background: C[f] }}>{f}</span>)}</span>;
}
