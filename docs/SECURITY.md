# Security notes

## What protects what
- **Access.** Pro and Premium tools are free for every signed-in user. There are no access codes and no payment. Access still requires an account and is checked on the server (and in row level security through `is_pro()` / `is_premium()`, which mean "signed in"), never in the browser. Anonymous visitors cannot use the account-bound tools.
- **Database**: row level security on every table. The browser can read only what policies and views expose. Every write goes through our server, which validates it first. Migration `0006_hardening.sql` also revokes direct access, so a mistaken policy cannot expose server only tables.
- **Secrets** live in environment variables on the server. `npm run scan` fails if a key shaped string is committed, and CI runs it.
- **API guard** (`src/proxy.ts`): cross-site POSTs are blocked by an Origin check, request bodies over 64 KB are refused, and every route has a per-IP rate limit. The language model and model fitting routes have the tightest limits.
- **Headers**: content security policy, no framing, no sniffing, strict referrer policy, HSTS in production.
- **User text** is validated (length, links, repeats, blocked terms), rendered as text by React, and escaped in emails. Reports hide a post at three distinct reporters.
- **Email**: double opt in with a click (so link scanners cannot confirm for you), signed expiring tokens, one click unsubscribe, a daily cap.
- **AI**: language models see only a numbered fact list. Headlines are marked untrusted, replies are validated, and an answer far from the statistics is set aside. They can move a forecast by at most 25 percent.

## Fixed in the Phase 9 review
1. (Historical) Premium unlock once fell back to the Pro code. Access codes have since been removed.
2. Anyone with the public database key could read who liked which post. The policy is dropped.
3. `/api/context` returned bookmaker odds to Free users. Odds are now Pro only everywhere.
4. Email confirmation worked on a plain GET, so link scanners could confirm for a person. Confirmation now needs a click.
5. The cron secret was compared with `!==`. It now uses a constant time comparison.
6. Provider image URLs placed into CSS are now escaped.
7. Contact form subjects can no longer carry line breaks.

## Known limits, in order of importance
- **Rate limits are in memory per server instance.** On several instances or serverless regions, move the limiter to a shared store such as Redis or Upstash.
- **The content security policy still allows inline scripts and styles**, because Next.js and the homepage use them. A nonce based policy is the next step.
- **No automated alert** when a provider fails. `/admin` shows status, and `/api/health/ready` (with `CRON_SECRET`) is built for an uptime monitor.
- **Request logs go to the console only.** Use your host's log drain if you need history.
- **Admin accounts rely on Supabase Auth.** Turn on multi factor authentication for them.
- **Dependencies** are audited in CI with `npm audit`, which this review could not run offline.
- **No professional penetration test has been done.** Get one before handling anything sensitive.
- **Privacy policy and terms are plain language drafts.** Have a lawyer review them for your country.

## Security spec audit (GOALGRID_SECUIRITY.md)

**Built**
- Durable per-user limits (`rate_events`, migration 0007): posts 20/h, booking shares 5/h, comments 20/h, likes 60/h, reports 10/day, predictions 30/day, follows 30/h, proof uploads 2/day (stricter than the spec table's 5, matching the upload policy). Friendly generic message; thresholds never shown.
- Middleware sends anonymous visitors from signed-in and staff pages to `/sign-in?next=`. Every page and action still checks user and role on the server.
- Upload validator and proof uploads: JPG, PNG, WebP only, type read from bytes, 1 MB, server-made paths, private `proofs` bucket, short-lived signed links for the owner and staff only. A proof image never changes verification.
- Booking-code shares (migration 0009): users cannot set verification or moderation fields (the input schema rejects them), duplicates are blocked by a unique index, new accounts wait a day, shares never count toward records, leaderboards, ranks or trophies.
- Comments, likes, reports on shares; three reports put a share under review automatically.
- Follows, blocks (both directions, also removes follows) and mutes; feeds filter them.
- Trophies: nine starter trophies, idempotent, awarded from real prediction records and posts only, with an audit row per award.
- Public profile `/profile/[username]`: prediction record (hidden below 10 evaluated picks), trophies, recent predictions, community shares kept separate.
- Roles and account status: user, moderator, admin; active, warned, suspended, banned. A database trigger stops users editing role, status or suspension. Moderators can hide, remove, restore, review, verify, reject, warn and suspend (up to 7 days); only admins ban, unban or suspend longer. Moderators cannot act on staff.
- `/api/moderation` is the only path that changes moderation or verification state: role read from the database, transition checked against the current state, reason required, append-only audit rows (`moderation_actions`, `booking_verification_audits`). `/moderator` queue page.
- Append-only audit tables enforced by triggers.

**Not built**
- Booking verification against a real integration: shares stay unverified or "reviewed by staff". No bookmaker integration exists.
- Top Table uses the overall leaderboard, not separate verified periods. Extra picks (BTTS, over/under 2.5, exact score; migration 0011) are scored 2, 2 and 8 and feed the profile and Exact Eye, but have no separate leaderboards yet.
- Separate leaderboards (monthly, season, per market, per league), challenge leaderboards, favourite teams and leagues on profiles, notifications, `/login` and `/signup` URL names (the app uses `/sign-in`).
- Moderation notes are in the schema but have no UI.
- Nothing here was run against a real Postgres or Supabase Storage: RLS, triggers and bucket policy are untested.

**Before deploying:** run migrations 0007 to 0012 in order.
