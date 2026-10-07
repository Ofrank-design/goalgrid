const dev = process.env.NODE_ENV !== "production";
/** Content security policy. Inline scripts and styles are still allowed because Next.js use them; a nonce based policy is the next step. */
const csp = ["default-src 'self'", `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`, "style-src 'self' 'unsafe-inline'", "font-src 'self'", "img-src 'self' data: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'", "object-src 'none'", ...(dev ? [] : ["upgrade-insecure-requests"])].join("; ");
const security = [{ key: "Content-Security-Policy", value: csp }, { key: "X-Content-Type-Options", value: "nosniff" }, { key: "X-Frame-Options", value: "DENY" }, { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" }, { key: "Cross-Origin-Opener-Policy", value: "same-origin" }, ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }])];
export default { poweredByHeader: false, async headers() { return [{ source: "/:path*", headers: security }]; } };
