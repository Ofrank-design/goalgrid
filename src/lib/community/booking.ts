import { z } from "zod";
export type Verification = "unverified" | "pending_review" | "verified" | "rejected" | "expired";
export type ModStatus = "active" | "hidden" | "removed" | "under_review";
export const BOOKING_NOTICE = "Community shares are not verified betting advice. Booking codes and claimed results may be inaccurate. Make independent decisions.";
export const VERIFICATION_LABEL: Record<Verification, string> = { unverified: "Unverified community submission", pending_review: "Pending review", verified: "Reviewed by GoalGrid staff", rejected: "Rejected", expired: "Expired" };
/** Never accept moderation or verification fields from a user: this schema simply has no place for them. */
export const bookingInput = z.object({
  bookingCode: z.string().trim().min(3).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9 _.\-/]*$/, "Use letters, numbers and - _ . / only"),
  bookmaker: z.string().trim().min(2).max(40).optional(), matchId: z.string().regex(/^(sm|fd):\d+$/).optional(), odds: z.number().min(1.01).max(10_000).optional(),
  note: z.string().trim().max(300).optional(), visibility: z.enum(["public", "followers", "private"]).default("public"),
}).strict();
export function checkNote(note: string | undefined): { ok: true; text: string | null } | { ok: false; error: string } {
  if (!note) return { ok: true, text: null }; const text = note.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if ((text.match(/https?:\/\/|www\./gi) ?? []).length > 1) return { ok: false, error: "Too many links." }; if (/(.)\1{9,}/.test(text)) return { ok: false, error: "That looks like spam." };
  if (/\b(guaranteed|sure win|can'?t lose|100% (win|sure))\b/i.test(text)) return { ok: false, error: "Please avoid guarantees. Nobody can promise a result." };
  return { ok: true, text: text || null };
}
/** Which staff action is allowed from which state. Anything not listed is refused. */
export const VERIFY_FLOW: Record<string, { from: Verification[]; to: Verification }> = { review: { from: ["unverified"], to: "pending_review" }, verify: { from: ["pending_review"], to: "verified" }, reject: { from: ["unverified", "pending_review"], to: "rejected" } };
export const MOD_FLOW: Record<string, { from: ModStatus[]; to: ModStatus }> = { hide: { from: ["active", "under_review"], to: "hidden" }, remove: { from: ["active", "hidden", "under_review"], to: "removed" }, restore: { from: ["hidden", "removed", "under_review"], to: "active" } };
export const REPORTS_TO_REVIEW = 3;
/** Booking shares never count toward accuracy, leaderboards, ranks or trophies, whatever their verification state. */
export const countsTowardRecord = (_post: { verification_status: Verification }) => false;
