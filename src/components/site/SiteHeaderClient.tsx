"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";

const links = [
  ["Home", "/"],
  ["Matches", "/dashboard"],
  ["Predictions", "/predictions"],
  ["Leagues", "/leagues"],
  ["Teams", "/teams"],
  ["Free access", "/pricing"],
  ["Analytics", "/accuracy"],
  ["Live", "/dashboard?view=live"],
] as const;

/** The header is rendered in full without search params first, so static pages keep their layout. Only the "Live" highlight needs the query string. */
export function SiteHeaderClient() {
  return <Suspense fallback={<HeaderView isLiveView={false} />}><HeaderWithSearch /></Suspense>;
}

function HeaderWithSearch() {
  const searchParams = useSearchParams();
  return <HeaderView isLiveView={searchParams.get("view") === "live"} />;
}

function HeaderView({ isLiveView: liveParam }: { isLiveView: boolean }) {
  const pathname = usePathname();
  const isLiveView = pathname === "/dashboard" && liveParam;
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" && !isLiveView;
    if (href === "/dashboard?view=live") return isLiveView;
    if (href === "/") return pathname === "/";
    const base = href.split("?")[0];
    return pathname === base || pathname.startsWith(`${base}/`);
  };

  return (
    <header className="si-hdr">
      <div className="si-nav">
        <Link href="/" className="si-logo" aria-label="GoalGrid home"><img src="/brand/logo.webp" alt="GoalGrid, AI football intelligence" width={176} height={39} /></Link>
        <nav className="si-links" aria-label="Main">
          {links.map(([label, href]) => <Link key={href} className={isActive(href) ? "on" : undefined} aria-current={isActive(href) ? "page" : undefined} href={href}>{label}</Link>)}
        </nav>
        <div className="si-nr">
          <GlobalSearch compact />
          <Link className="si-b sm g2" href="/sign-in">Sign In</Link>
          <Link className="si-b sm p" href="/sign-in?mode=signup">Get Started</Link>
        </div>
      </div>
    </header>
  );
}
