import Link from "next/link";
import type { ReactNode } from "react";
import site from "@/content/site.json";
import { isExternal, tokenize } from "@/lib/site/inline";
export interface Section { id: string; heading: string; paragraphs?: string[]; bullets?: string[]; note?: string; slot?: string }
export interface PageData { slug: string; title: string; eyebrow: string; lead: string; sections: Section[] }
function Inline({ text }: { text: string }) {
  return <>{tokenize(text).map((t, i) => t.t === "text" ? <span key={i}>{t.v}</span> : isExternal(t.href) ? <a key={i} href={t.href} target="_blank" rel="noopener noreferrer">{t.v}</a> : t.href.startsWith("mailto:") ? <a key={i} href={t.href}>{t.v}</a> : <Link key={i} href={t.href}>{t.v}</Link>)}</>;
}
/** One layout for all six pages: hero band, "on this page" list, and a readable article column. Only the content changes. */
export function InfoPage({ data, form }: { data: PageData; form?: ReactNode }) {
  return (<>
    <section className="si-hero"><div className="si-hero-bg" style={{ backgroundImage: `url(/site/${data.slug}.webp)` }} /><div className="si-hc"><div className="in">
      <div className="si-eb">{data.eyebrow}</div><h1>{data.title}</h1><p className="si-lead">{data.lead}</p><p className="si-upd">Last updated {site.updated}</p></div></div></section>
    <main className="si-main"><div className="si-w"><div className="si-art">
      <aside><nav className="si-toc" aria-label="On this page"><div className="si-toc-h">ON THIS PAGE</div>{data.sections.map(s => <a key={s.id} href={`#${s.id}`}>{s.heading}</a>)}</nav></aside>
      <article className="si-prose">{data.sections.map(s => (
        <section key={s.id} id={s.id}><h2>{s.heading}</h2>
          {s.slot === "form" ? form : <>
            {s.paragraphs?.map((p, i) => <p key={i}><Inline text={p} /></p>)}
            {s.bullets && <ul>{s.bullets.map((b, i) => <li key={i}><Inline text={b} /></li>)}</ul>}
            {s.note && <div className="si-note"><Inline text={s.note} /></div>}</>}
        </section>))}</article>
    </div></div></main>
  </>);
}
