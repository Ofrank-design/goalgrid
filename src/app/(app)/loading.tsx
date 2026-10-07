/** Shown while a server page streams in, so slow data never leaves a blank screen. Shapes match the usual page: a heading, a line of text, then cards. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="skel" style={{ height: 30, width: "34%", marginBottom: 12 }} />
      <div className="skel" style={{ height: 14, width: "58%", marginBottom: 24 }} />
      <div className="grid">{[0, 1, 2, 3, 4, 5].map(i => <div key={i} className="card skel" style={{ height: 120 }} />)}</div>
    </div>
  );
}
