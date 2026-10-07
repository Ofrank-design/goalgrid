import { createHmac, timingSafeEqual } from "node:crypto";
const b64 = (b: Buffer) => b.toString("base64url");
/** Signed, expiring link tokens for email confirmation and unsubscribe. The kind stops a token for one purpose working for another. */
export function signToken(kind: string, subject: string, secret: string, ttlMs: number, now = Date.now()): string {
  const body = b64(Buffer.from(JSON.stringify({ k: kind, s: subject, e: now + ttlMs })));
  return `${body}.${b64(createHmac("sha256", secret).update(body).digest())}`;
}
export function verifyToken(token: string, kind: string, secret: string, now = Date.now()): string | null {
  const [body, sig] = token.split("."); if (!body || !sig) return null;
  const want = createHmac("sha256", secret).update(body).digest(), got = Buffer.from(sig, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.k === kind && typeof p.s === "string" && p.e > now ? p.s : null; } catch { return null; }
}
