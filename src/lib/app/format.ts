export const pct = (x: number) => `${Math.round(x * 100)}%`;
/** Current time in ms. Server pages call this instead of reading the clock inline during render. */
export const nowMs = () => Date.now();
export const todayUtc = () => new Date().toISOString().slice(0, 10);
export function validDate(d: string | undefined): string | null { return d && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) ? d : null; }
export function shiftDate(d: string, days: number): string { const t = new Date(d + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); }
export const kickoffLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }) + " UTC";
/** Only allow same site paths as redirect targets. */
export const safeNext = (n: string | null | undefined) => (n && n.startsWith("/") && !n.startsWith("//") ? n : "/dashboard");
export const matchHref = (id: string, date: string) => `/matches/${encodeURIComponent(id)}?date=${date}`;
