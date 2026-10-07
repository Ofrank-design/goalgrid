/** A photo hero for a lab or community page. Decorative image, so alt text is empty; the heading carries the meaning. */
export function PageHero({ image, title, subtitle, badge, position, children }: { image: "simulation" | "lounge" | "community"; title: string; subtitle: string; badge?: string; position?: string; children?: React.ReactNode }) {
  return (<section className="page-hero" style={position ? ({ "--hero-pos": position } as React.CSSProperties) : undefined}><img src={`/hero/${image}.webp`} alt="" width={1600} height={900} fetchPriority="high" />
    <div className="in">{badge && <span className="badge pro" style={{ justifySelf: "start" }}>{badge}</span>}<h1>{title}</h1><p>{subtitle}</p>{children}</div></section>);
}
