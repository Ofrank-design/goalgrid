export const MAX_BODY = 500, REPORT_HIDE_THRESHOLD = 3, POST_LIMIT = { max: 5, windowMin: 5 };
export const parseBlocked = (s?: string) => (s ?? "").split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
export const validUsername = (u: unknown): u is string => typeof u === "string" && /^[a-z0-9_]{3,20}$/.test(u);
export type BodyCheck = { ok: true; text: string } | { ok: false; error: string };
/** Basic spam and safety rules for user text. The blocked terms list comes from configuration, so you can tune it without a deploy. */
export function validateBody(raw: unknown, blocked: string[] = []): BodyCheck {
  if (typeof raw !== "string") return { ok: false, error: "Write something first." };
  const text = raw.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return { ok: false, error: "Write something first." };
  if (text.length > MAX_BODY) return { ok: false, error: `Keep it under ${MAX_BODY} characters.` };
  if ((text.match(/https?:\/\/|www\./gi) ?? []).length > 2) return { ok: false, error: "Too many links." };
  if (/(.)\1{9,}/.test(text)) return { ok: false, error: "That looks like spam." };
  const lower = text.toLowerCase(); if (blocked.some(t => lower.includes(t))) return { ok: false, error: "That message breaks the community rules." };
  return { ok: true, text };
}

/** Fixed report reasons from the safety spec, so reports can be sorted and counted. */
export const REPORT_CATEGORIES = ["spam", "misleading", "harassment", "hate", "impersonation", "inappropriate", "scam", "abuse", "other"] as const;
