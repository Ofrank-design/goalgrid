import { CLUBS, LEAGUES } from "@/lib/football/clubs";
/** Public, stable pages only. Match pages change daily and are left out. */
export default function sitemap() {
  const site = (process.env.SITE_URL ?? "").replace(/\/$/, ""); if (!site) return [];
  const paths = ["", "/about", "/methodology", "/responsible-use", "/privacy", "/terms", "/contact", "/accuracy", "/leagues", "/teams", "/dashboard", "/community", "/leaderboard", ...LEAGUES.map(l => `/leagues/${l.slug}`), ...CLUBS.map(c => `/teams/${c.slug}`)];
  return paths.map(p => ({ url: site + p, lastModified: new Date() }));
}
