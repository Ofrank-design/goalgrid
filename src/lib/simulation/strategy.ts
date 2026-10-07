/** What may be shared in the strategy library, and what may not. The check is deliberately blunt: it blocks, and says why. */
const RULES: { re: RegExp; reason: string }[] = [
  { re: /\b(guarantee[ds]?|guaranteed (profit|win|return)s?|risk[- ]?free|can'?t lose|sure (win|bet|thing)|100% (win|sure|accurate))\b/i, reason: "No guarantees or risk-free claims. Nobody can promise a result." },
  { re: /\b(profit machine|winning system|safe strategy|printing money|beats? the (bookies?|bookmakers?|house|game))\b/i, reason: "No claims that a strategy defeats a game or a provider." },
  { re: /\b(deposit|send (me )?money|pay (me|for access)|dm me to buy|buy my|paid (tips|picks|system)|subscribe to my)\b/i, reason: "No requests for money, deposits or paid systems." },
  { re: /\b(affiliate|referral|promo code|sign[- ]?up bonus|use my link|bet ?365|1xbet|betway|sportybet|bet9ja)\b/i, reason: "No affiliate links, referral codes or bookmaker promotion." },
  { re: /\b(auto[- ]?bet|bot (that )?(places?|bets?)|automatic(ally)? (place|bet)|place (the )?bets? for you)\b/i, reason: "No automated betting instructions." },
  { re: /https?:\/\/|www\./i, reason: "Links are not allowed in shared strategies." },
];
export function checkShare(text: string): { ok: true } | { ok: false; reasons: string[] } { const reasons = RULES.filter(r => r.re.test(text)).map(r => r.reason); return reasons.length ? { ok: false, reasons } : { ok: true }; }
/** Ranking by research quality, never by claimed profit. Each part is 0 to 1; the score is their mean. */
export function researchQuality(p: { hasSeed: boolean; sampleSize: number; hasAssumptions: boolean; hasMethod: boolean; likes: number }) {
  const parts = { reproducibility: p.hasSeed ? 1 : 0, sampleSize: Math.min(1, p.sampleSize / 1000), assumptions: p.hasAssumptions ? 1 : 0, methodology: p.hasMethod ? 1 : 0, peerFeedback: Math.min(1, p.likes / 20) }; return { score: Math.round((Object.values(parts).reduce((a, b) => a + b, 0) / 5) * 100) / 100, parts };
}
