export type Role = "user" | "moderator" | "admin"; export type AccountStatus = "active" | "warned" | "suspended" | "banned";
export type ModAction = "hide" | "remove" | "restore" | "review" | "verify" | "reject" | "warn" | "suspend" | "ban" | "unban";
const MOD: ModAction[] = ["hide", "remove", "restore", "review", "verify", "reject", "warn", "suspend"], ADMIN: ModAction[] = [...MOD, "ban", "unban"];
export const MAX_MOD_SUSPEND_DAYS = 7, MAX_SUSPEND_DAYS = 365;
/** What each role may do. Checked on the server for every action, after the role is read from the database. */
export const can = (role: Role, action: ModAction) => (role === "admin" ? ADMIN : role === "moderator" ? MOD : []).includes(action);
export const suspendDaysAllowed = (role: Role, days: number) => Number.isInteger(days) && days >= 1 && days <= (role === "admin" ? MAX_SUSPEND_DAYS : MAX_MOD_SUSPEND_DAYS);
/** A user can reach staff-only targets only if the target outranks no one: staff cannot be actioned by moderators. */
export const canActOnUser = (actor: Role, target: Role) => (actor === "admin" ? target !== "admin" : actor === "moderator" && target === "user");
export type Gate = { canPost: boolean; reason: string | null };
export function accountGate(status: AccountStatus, suspendedUntil: string | null, now = Date.now()): Gate {
  if (status === "banned") return { canPost: false, reason: "This account can no longer post." };
  if (status === "suspended" && suspendedUntil && Date.parse(suspendedUntil) > now) return { canPost: false, reason: `Posting is paused until ${new Date(suspendedUntil).toUTCString()}.` };
  return { canPost: true, reason: null };
}
/** Accounts under a day old cannot share booking codes yet. */
export const isNewAccount = (createdAt: string, now = Date.now()) => now - Date.parse(createdAt) < 86_400_000;
export const reasonOk = (r: unknown): r is string => typeof r === "string" && r.trim().length >= 5 && r.length <= 300;
