import "server-only";
import { env } from "@/lib/env";
import { providerFetch } from "../http";
import { ProviderError } from "../types";
/** Resend only sends from a verified domain. Until you verify one, EMAIL_FROM can be onboarding@resend.dev, which delivers to your own address only. */
export const emailConfigured = () => Boolean(env().RESEND_API_KEY);
export async function sendEmail(m: { to: string; subject: string; html: string; text: string; unsubscribeUrl?: string; replyTo?: string }): Promise<{ id: string }> {
  const key = env().RESEND_API_KEY; if (!key) throw new ProviderError("resend", "auth", "Not configured");
  const { json } = await providerFetch<{ id?: string }>({ provider: "resend", url: "https://api.resend.com/emails", method: "POST", retries: 0, timeoutMs: 15_000, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "GoalGrid <onboarding@resend.dev>", to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.replyTo ? { reply_to: m.replyTo } : {}), ...(m.unsubscribeUrl ? { headers: { "List-Unsubscribe": `<${m.unsubscribeUrl}>` } } : {}) }) });
  if (!json.id) throw new ProviderError("resend", "bad_response", "No id in reply"); return { id: json.id };
}
