export const TOPICS = { general: "General question", bug: "Report a bug", data: "Correct some data", privacy: "Privacy or account request", partnership: "Partnership or press" } as const;
export type Topic = keyof typeof TOPICS;
export interface ContactInput { name: string; email: string; topic: Topic; message: string; website?: string }
export type ContactCheck = { ok: true; data: ContactInput } | { ok: false; error: string };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Shared by the form and the API route, so the browser and the server apply the same rules. */
export function checkContact(raw: unknown): ContactCheck {
  const r = (raw ?? {}) as Record<string, unknown>, s = (k: string) => (typeof r[k] === "string" ? (r[k] as string).trim() : "");
  const name = s("name"), email = s("email"), message = s("message").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ""), topic = s("topic") as Topic;
  if (!name || name.length > 80) return { ok: false, error: "Please enter your name." };
  if (!EMAIL.test(email) || email.length > 200) return { ok: false, error: "Please enter a valid email address." };
  if (!(topic in TOPICS)) return { ok: false, error: "Please choose a topic." };
  if (message.length < 10) return { ok: false, error: "Please write a little more, at least 10 characters." };
  if (message.length > 2000) return { ok: false, error: "Please keep your message under 2000 characters." };
  return { ok: true, data: { name, email: email.toLowerCase(), topic, message, website: s("website") } };
}
