/**
 * Best estimate of the caller's address, safe to use as a rate limit key.
 *
 * On Vercel the platform sets x-vercel-forwarded-for and x-real-ip itself, so they can be trusted there. Anywhere else a client can send
 * those headers, so they are ignored and x-forwarded-for is read from the RIGHT: each proxy appends the address it saw, so everything left
 * of the trusted hops was supplied by the client and can be forged. TRUSTED_PROXY_HOPS is how many proxies you run in front of the app
 * (default 1). Without any proxy header the result is "unknown", which is one shared bucket: strict, never bypassable.
 */
export function clientIp(
  headers: Pick<Headers, "get">,
  trustedHops = Number(process.env.TRUSTED_PROXY_HOPS ?? 1),
  onVercel = process.env.VERCEL === "1",
): string {
  const first = (v: string | null) => v?.split(",")[0]?.trim() ?? "";
  if (onVercel) { const platform = first(headers.get("x-vercel-forwarded-for")) || first(headers.get("x-real-ip")); if (platform) return platform; }
  const hops = (headers.get("x-forwarded-for") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  if (!hops.length) return "unknown";
  const n = Number.isFinite(trustedHops) && trustedHops >= 1 ? Math.floor(trustedHops) : 1;
  return hops[Math.max(0, hops.length - n)];
}
