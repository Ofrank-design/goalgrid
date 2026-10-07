"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface SearchResult {
  query: string;
  teams: { name: string; slug: string; league: string }[];
  leagues: { name: string; slug: string; country: string }[];
  players: { id: string; name: string; position: string | null; nationality: string | null; teamName: string | null; teamSlug: string | null }[];
  community: { id: string; username: string; excerpt: string; createdAt: string }[];
  playerSearchAvailable: boolean;
}

export function GlobalSearch({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [fetched, setResult] = useState<SearchResult | null>(null);
  const result = query.trim().length < 2 ? null : fetched;
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const commandK = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (commandK) {
        event.preventDefault();
        setOpen(true);
        return;
      }
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    if (open) inputRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal, headers: { Accept: "application/json" } });
        if (response.ok) setResult((await response.json()) as SearchResult);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResult(null);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <>
      <button className={compact ? "global-search-button compact" : "global-search-button"} type="button" aria-label="Search GoalGrid" title="Search GoalGrid (⌘K / Ctrl+K)" onClick={() => setOpen(true)}>
        <span className="search-glyph" aria-hidden="true" />
        {!compact && <span>Search</span>}
      </button>

      {open && (
        <div className="search-layer" role="dialog" aria-modal="true" aria-label="Search GoalGrid" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
          <div className="search-panel">
            <div className="search-topline">
              <span className="search-kicker">GOALGRID SEARCH</span>
              <button type="button" className="search-close" onClick={() => setOpen(false)} aria-label="Close search">Esc</button>
            </div>
            <div className="search-input-wrap">
              <span className="search-glyph" aria-hidden="true" />
              <input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Teams, players, leagues or community" aria-label="Search teams, players, leagues or community" />
            </div>

            {query.trim().length < 2 ? (
              <div className="search-empty">Search across GoalGrid's football catalogue and community.</div>
            ) : result ? (
              <div className="search-results">
                {result.leagues.length > 0 && <SearchGroup title="Leagues">{result.leagues.map((league) => <Link key={league.slug} href={`/leagues/${league.slug}`} onClick={() => setOpen(false)}><strong>{league.name}</strong><span>{league.country}</span></Link>)}</SearchGroup>}
                {result.teams.length > 0 && <SearchGroup title="Teams">{result.teams.map((team) => <Link key={team.slug} href={`/teams/${team.slug}`} onClick={() => setOpen(false)}><strong>{team.name}</strong><span>{team.league}</span></Link>)}</SearchGroup>}
                {result.players.length > 0 && <SearchGroup title="Players">{result.players.map((player) => <Link key={player.id} href={`/players/${player.id}`} onClick={() => setOpen(false)}><strong>{player.name}</strong><span>{[player.position, player.teamName, player.nationality].filter(Boolean).join(" · ") || "Player"}</span></Link>)}</SearchGroup>}
                {result.community.length > 0 && <SearchGroup title="Community">{result.community.map((post) => <Link key={post.id} href={`/community?post=${encodeURIComponent(post.id)}`} onClick={() => setOpen(false)}><strong>@{post.username}</strong><span>{post.excerpt}</span></Link>)}</SearchGroup>}
                {!result.leagues.length && !result.teams.length && !result.players.length && !result.community.length && <div className="search-empty">Nothing matched “{result.query}”.</div>}
                {!result.playerSearchAvailable && <div className="search-note">Player search becomes live when the Sportmonks player feed is connected.</div>}
                <Link className="search-all" href={`/search?q=${encodeURIComponent(result.query)}`} onClick={() => setOpen(false)}>Open full search results →</Link>
              </div>
            ) : <div className="search-empty">Searching…</div>}
          </div>
        </div>
      )}
    </>
  );
}

function SearchGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="search-group"><div className="search-group-title">{title}</div>{children}</section>;
}
