"use client";

import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

/* ------------------------------------------------------------------ data */

export interface MatchView {
  href?: string;
  lg: string;
  league: string;
  home: string;
  away: string;
  hc: string;
  ac: string;
  /** CSS declarations for the crest fallback, for example "background:#c8102e". */
  hb: string;
  ab: string;
  hu?: string | null;
  au?: string | null;
  when: string;
  score: string;
  p: [number, number, number];
}

const SAMPLE: MatchView[] = [
  { lg: "pl", league: "Premier League", home: "Arsenal", away: "Chelsea", hc: "ARS", ac: "CHE", hb: "background:#c8102e", ab: "background:#034694", when: "Sample fixture, 16:30", score: "2 - 1", p: [57, 24, 19] },
  { lg: "ll", league: "LaLiga", home: "Real Madrid", away: "Barcelona", hc: "RMA", ac: "FCB", hb: "background:#f2f2f2;color:#1a2a5a", ab: "background:#a50044", when: "Sample fixture, 20:00", score: "1 - 1", p: [42, 28, 30] },
  { lg: "sa", league: "Serie A", home: "Inter", away: "Napoli", hc: "INT", ac: "NAP", hb: "background:#0a2a6b", ab: "background:#12a0d7", when: "Sample fixture, 19:45", score: "2 - 0", p: [64, 20, 16] },
  { lg: "bl", league: "Bundesliga", home: "Bayern Munich", away: "Dortmund", hc: "BAY", ac: "BVB", hb: "background:#dc052d", ab: "background:#fde100;color:#111", when: "Sample fixture, 17:30", score: "3 - 1", p: [62, 22, 16] },
];

const SAMPLE_PILL = "Sample data until providers are connected";
const LEAGUE_CLASS: Record<string, string> = {
  "premier-league": "pl",
  "la-liga": "ll",
  "serie-a": "sa",
  "bundesliga": "bl",
  "ligue-1": "l1",
};
const BUILT_IN_CRESTS = ["ars", "che", "rma", "fcb", "int", "nap", "bay", "bvb"];

/** Turns "background:#fff;color:#000" into a React style object. */
function cssText(text: string): CSSProperties {
  const style: Record<string, string> = {};
  for (const part of text.split(";")) {
    const [key, ...rest] = part.split(":");
    if (!key || !rest.length) continue;
    style[key.trim().replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = rest.join(":").trim();
  }
  return style as CSSProperties;
}

function Crest({ code, fallback, url }: { code: string; fallback: string; url?: string | null }) {
  if (url && /^(https:\/\/|\/crests\/)/.test(url)) {
    return <div className="cr im" role="img" aria-label={code} style={{ backgroundImage: `url("${encodeURI(url).replace(/"/g, "%22")}")` }} />;
  }
  const key = code.toLowerCase();
  if (BUILT_IN_CRESTS.includes(key)) {
    return <div className="cr im" role="img" aria-label={key} style={{ backgroundImage: `var(--c-${key})` }} />;
  }
  return <div className="cr" style={cssText(fallback)}>{key.toUpperCase()}</div>;
}

function LeagueMark({ lg }: { lg: string }) {
  return <i style={{ backgroundImage: `var(--${lg})`, ...(lg === "l1" ? { backgroundColor: "#081c3d" } : {}) }} />;
}

/* --------------------------------------------------------------- context */

interface HomeState {
  views: MatchView[];
  live: boolean;
  toast: (message: string) => void;
  toastText: string;
  toastOn: boolean;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const HomeContext = createContext<HomeState | null>(null);
function useHome() {
  const value = useContext(HomeContext);
  if (!value) throw new Error("Home components must be rendered inside HomeProvider");
  return value;
}

interface PredictionItem {
  prediction?: {
    mostLikelyScore: { home: number; away: number };
    probabilities: { home: number; draw: number; away: number };
  };
  match?: {
    id: string | number;
    status: string;
    kickoffUtc: string;
    league: { slug: string; name: string };
    home: { name: string; shortName?: string; slug: string; crestUrl?: string | null };
    away: { name: string; shortName?: string; slug: string; crestUrl?: string | null };
  };
}

/** Whole-number percentages that always add up to 100. */
function percentages(p: { home: number; draw: number; away: number }): [number, number, number] {
  const r = [p.home, p.draw, p.away].map((x) => Math.round(x * 100));
  r[r.indexOf(Math.max(...r))] += 100 - r.reduce((a, b) => a + b, 0);
  return [r[0], r[1], r[2]];
}

async function loadLiveViews(signal: AbortSignal): Promise<MatchView[] | null> {
  let manifest: Record<string, string> = {};
  try {
    const mr = await fetch("/crests/manifest.json");
    if (mr.ok) manifest = await mr.json();
  } catch {
    /* local crests are optional */
  }
  const local = (slug: string) => (manifest[slug] ? `/crests/${manifest[slug]}.webp` : null);

  const r = await fetch(`/api/predictions?date=${new Date().toISOString().slice(0, 10)}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!r.ok || !(r.headers.get("content-type") || "").includes("json")) return null;
  const j: { items?: PredictionItem[]; date: string } = await r.json();

  const ok = (j.items || []).filter(
    (i) => i.prediction && i.match && LEAGUE_CLASS[i.match.league.slug] && ["scheduled", "live"].includes(i.match.status),
  );
  const seen = new Set<string>();
  const pick: PredictionItem[] = [];
  for (const i of ok) {
    if (!seen.has(i.match!.league.slug) && pick.length < 4) {
      seen.add(i.match!.league.slug);
      pick.push(i);
    }
  }
  for (const i of ok) {
    if (pick.length >= 4) break;
    if (!pick.includes(i)) pick.push(i);
  }
  if (!pick.length) return null;

  return pick.map((i) => {
    const m = i.match!;
    const p = i.prediction!;
    const d = new Date(m.kickoffUtc);
    const today = d.toDateString() === new Date().toDateString();
    return {
      href: `/matches/${encodeURIComponent(m.id)}?date=${j.date}`,
      lg: LEAGUE_CLASS[m.league.slug],
      league: m.league.name,
      home: m.home.name,
      away: m.away.name,
      hc: (m.home.shortName || m.home.name).slice(0, 3),
      ac: (m.away.shortName || m.away.name).slice(0, 3),
      hb: "background:#2a3a4a",
      ab: "background:#2a3a4a",
      hu: local(m.home.slug) || m.home.crestUrl,
      au: local(m.away.slug) || m.away.crestUrl,
      when:
        (today ? "Today" : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })) +
        ", " +
        d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      score: `${p.mostLikelyScore.home} - ${p.mostLikelyScore.away}`,
      p: percentages(p.probabilities),
    };
  });
}

export function HomeProvider({ children }: { children: ReactNode }) {
  const [views, setViews] = useState<MatchView[]>(SAMPLE);
  const [live, setLive] = useState(false);
  const [toastText, setToastText] = useState("");
  const [toastOn, setToastOn] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const toast = (message: string) => {
    setToastText(message);
    setToastOn(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToastOn(false), 3200);
  };

  // Live fixtures replace the sample cards when the app has data; otherwise the samples stay.
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    loadLiveViews(controller.signal)
      .then((next) => {
        if (next) {
          setViews(next);
          setLive(true);
        }
      })
      .catch(() => undefined)
      .finally(() => clearTimeout(timeout));
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <HomeContext.Provider value={{ views, live, toast, toastText, toastOn, searchOpen, setSearchOpen }}>
      {children}
    </HomeContext.Provider>
  );
}

/* ------------------------------------------------------------ fixtures */

export function TodayMatches() {
  const { views } = useHome();
  return (
    <div className="today-grid" id="today-matches">
      {views.map((m) => (
        <Link className="today-match" href="/dashboard" key={`${m.home}-${m.away}`}>
          <div className="lh"><LeagueMark lg={m.lg} />{m.league}<span className="today-arrow">→</span></div>
          <div className="today-teams"><strong>{m.home}</strong><span>vs</span><strong>{m.away}</strong></div>
          <div className="today-meta"><span>{m.when}</span><span>Match centre</span></div>
        </Link>
      ))}
    </div>
  );
}

export function PredictionCards() {
  const { views } = useHome();
  return (
    <div className="mc" id="mc">
      {views.map((m) => (
        <Link className="m" href={m.href || "#"} key={`${m.home}-${m.away}`}>
          <div className="lh"><LeagueMark lg={m.lg} />{m.league}</div>
          <h5>{m.home}<span>vs</span>{m.away}</h5>
          <div className="d">{m.when}</div>
          <div className="mid">
            <Crest code={m.hc} fallback={m.hb} url={m.hu} />
            <div><b>{m.score}</b><small>Predicted Score</small></div>
            <Crest code={m.ac} fallback={m.ab} url={m.au} />
          </div>
          <div className="pc">
            <div><b>{m.p[0]}%</b>Home Win</div>
            <div><b>{m.p[1]}%</b>Draw</div>
            <div><b>{m.p[2]}%</b>Away Win</div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function LivePill({ id, liveText }: { id: string; liveText: string }) {
  const { live } = useHome();
  return <span className="pill" id={id}>{live ? liveText : SAMPLE_PILL}</span>;
}

/* -------------------------------------------------------------- header */

const subscribeScroll = (onChange: () => void) => {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
};

export function ScrollHeader({ children }: { children: ReactNode }) {
  const scrolled = useSyncExternalStore(subscribeScroll, () => window.scrollY > 40, () => false);
  return <header id="hd" className={scrolled ? "on" : undefined}>{children}</header>;
}

export function SearchButton() {
  const { setSearchOpen } = useHome();
  return (
    <button className="s" id="site-search-open" aria-label="Search GoalGrid" onClick={() => setSearchOpen(true)}>
      <svg className="ic"><use href="#i-search" /></svg>
    </button>
  );
}

/* -------------------------------------------------------------- search */

interface SearchPayload {
  leagues: { slug: string; name: string; country: string }[];
  teams: { slug: string; name: string; league: string }[];
  players: { id: string | number; name: string; position?: string; teamName?: string; nationality?: string }[];
  community: { id: string | number; username: string; excerpt: string }[];
}
type SearchOutcome = { q: string; data: SearchPayload } | { q: string; error: true };

const SEARCH_HINT = "Search across GoalGrid's football catalogue and community.";

function SearchGroup<T>({ title, items, render }: { title: string; items: T[]; render: (item: T) => ReactNode }) {
  if (!items.length) return null;
  return <div className="ssg"><h4>{title}</h4>{items.map(render)}</div>;
}

export function SearchOverlay() {
  const { searchOpen, setSearchOpen } = useHome();
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const q = query.trim();

  const close = () => {
    setSearchOpen(false);
    setQuery("");
    setOutcome(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
        setQuery("");
        setOutcome(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchOpen, setSearchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = setTimeout(() => input.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [searchOpen]);

  useEffect(() => {
    if (q.length < 2) return;
    let stale = false;
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { headers: { Accept: "application/json" } });
        const data: SearchPayload = await r.json();
        if (!stale) setOutcome({ q, data });
      } catch {
        if (!stale) setOutcome({ q, error: true });
      }
    }, 180);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  let results: ReactNode;
  if (q.length < 2) results = <p>{SEARCH_HINT}</p>;
  else if (!outcome || outcome.q !== q) results = <p>Searching…</p>;
  else if ("error" in outcome) results = <p>Search is unavailable right now. Try again.</p>;
  else {
    const { leagues, teams, players, community } = outcome.data;
    const empty = !leagues.length && !teams.length && !players.length && !community.length;
    results = (
      <>
        <SearchGroup title="Leagues" items={leagues} render={(x) => (
          <Link key={x.slug} href={`/leagues/${encodeURIComponent(x.slug)}`}><strong>{x.name}</strong><span>{x.country}</span></Link>
        )} />
        <SearchGroup title="Teams" items={teams} render={(x) => (
          <Link key={x.slug} href={`/teams/${encodeURIComponent(x.slug)}`}><strong>{x.name}</strong><span>{x.league}</span></Link>
        )} />
        <SearchGroup title="Players" items={players} render={(x) => (
          <Link key={x.id} href={`/players/${encodeURIComponent(x.id)}`}>
            <strong>{x.name}</strong>
            <span>{[x.position, x.teamName, x.nationality].filter(Boolean).join(" · ") || "Player"}</span>
          </Link>
        )} />
        <SearchGroup title="Community" items={community} render={(x) => (
          <Link key={x.id} href={`/community?post=${encodeURIComponent(x.id)}`}><strong>@{x.username}</strong><span>{x.excerpt}</span></Link>
        )} />
        {empty && <p>Nothing found for “{q}”.</p>}
        <Link className="ss-all" href={`/search?q=${encodeURIComponent(q)}`}>Open full search results →</Link>
      </>
    );
  }

  return (
    <div
      className={searchOpen ? "site-search-layer open" : "site-search-layer"}
      id="site-search"
      aria-hidden={!searchOpen}
      onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="site-search-panel" role="dialog" aria-modal="true" aria-label="Search GoalGrid">
        <div className="search-row">
          <span className="eb">GOALGRID SEARCH</span>
          <button type="button" id="site-search-close" className="search-close" aria-label="Close search" onClick={close}>Esc</button>
        </div>
        <form id="site-search-form" className="search-form" onSubmit={(e) => e.preventDefault()}>
          <svg className="ic"><use href="#i-search" /></svg>
          <input
            ref={input}
            id="site-search-input"
            autoComplete="off"
            placeholder="Search teams, players, leagues or community"
            aria-label="Search teams, players, leagues or community"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </form>
        <div id="site-search-results" className="site-search-results">{results}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- newsletter */

export function Newsletter() {
  const { toast } = useHome();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const email = form.querySelector("input")?.value ?? "";
    try {
      const r = await fetch("/api/email/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j: { error?: string } = await r.json().catch(() => ({}));
      toast(r.ok ? "Check your inbox to confirm your email." : j.error || "Could not sign you up. Try again.");
      if (r.ok) form.reset();
    } catch {
      toast("Network error. Try again.");
    }
  }
  return (
    <form className="nl" id="nl" onSubmit={submit}>
      <input type="email" required placeholder="Your email for match day previews" aria-label="Email" />
      <button className="b p sm" type="submit">Join</button>
    </form>
  );
}

export function Toast() {
  const { toastText, toastOn } = useHome();
  return <div id="toast" role="status" className={toastOn ? "on" : undefined}>{toastText}</div>;
}

/* ------------------------------------------------------------- reveal */

/** Fades each section in the first time it scrolls into view. */
export function RevealOnScroll() {
  useEffect(() => {
    const sections = document.querySelectorAll(".lux-section");
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      }),
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}
