import type { Match } from "../../../types/football";

/** Reject malformed fixtures before they reach feature generation or models. */
export function validateMatch(match: Match): string[] {
  const issues: string[] = [];

  if (!match.id || !match.home.providerId || !match.away.providerId) {
    issues.push("missing id");
  }

  if (match.home.slug === match.away.slug) {
    issues.push("home and away are the same team");
  }

  if (Number.isNaN(Date.parse(match.kickoffUtc))) {
    issues.push("invalid kickoff");
  }

  for (const goals of [match.score.home, match.score.away]) {
    if (goals !== null && (!Number.isInteger(goals) || goals < 0)) {
      issues.push("invalid score");
    }
  }

  if (
    match.status === "finished" &&
    (match.score.home === null || match.score.away === null)
  ) {
    issues.push("finished match without a score");
  }

  return issues;
}
