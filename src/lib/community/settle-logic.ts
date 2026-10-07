export type ChallengeRef = { id: string; title: string };
export type PickRow = { user_id: string; match_id: string; settled_at: string | null; points: number | null };

/** Which entrants have every pick settled for a finished challenge, and what they scored. Pure: all data is passed in, so settlement needs a fixed number of queries. */
export function challengeCompletions(challenges: ChallengeRef[], matchesByChallenge: Map<string, string[]>, entriesByChallenge: Map<string, string[]>, picks: PickRow[]) {
  const pickBy = new Map(picks.map(p => [`${p.user_id}|${p.match_id}`, p] as const));
  const out: { challengeId: string; title: string; userId: string; points: number }[] = [];
  for (const c of challenges) {
    const ids = matchesByChallenge.get(c.id) ?? []; if (!ids.length) continue;
    for (const userId of entriesByChallenge.get(c.id) ?? []) {
      const mine = ids.map(id => pickBy.get(`${userId}|${id}`)).filter((p): p is PickRow => !!p);
      if (mine.filter(p => p.settled_at).length !== ids.length) continue;
      out.push({ challengeId: c.id, title: c.title, userId, points: mine.reduce((sum, p) => sum + Number(p.points ?? 0), 0) });
    }
  }
  return out;
}
export const groupBy = <T>(rows: T[], key: (r: T) => string, value: (r: T) => string) => { const m = new Map<string, string[]>(); for (const r of rows) { const k = key(r); (m.get(k) ?? m.set(k, []).get(k)!).push(value(r)); } return m; };
