export function LeagueBadge({ slug, size = 44 }: { slug: string; size?: number }) {
  return <span className="lgtile" style={{ width: size, height: size }}><img src={`/leagues/${slug}.webp`} alt="" width={size - 14} height={size - 14} /></span>;
}
const C: Record<string, string> = { W: "#00e676", D: "#9fb2b8", L: "#ff5d5d" };
export function FormChips({ form }: { form: ("W" | "D" | "L")[] }) {
  return <span className="chips" style={{ gap: 4 }} aria-label={`Recent form: ${form.join(" ")}`}>{form.map((f, i) => <span key={i} style={{ width: 22, height: 22, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 800, color: "#04210f", background: C[f] }}>{f}</span>)}</span>;
}
