"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GlobalSearch } from "@/components/GlobalSearch";

const navigation = [
  ["Dashboard", "/dashboard"],
  ["Leagues", "/leagues"],
  ["Teams", "/teams"],
  ["Free access", "/pricing"],
  ["Pro", "/pro"],
  ["Premium", "/premium"],
  ["Simulation", "/simulation"],
  ["Game Lab", "/intelligence"],
  ["Community", "/community"],
  ["Challenges", "/challenges"],
] as const;

export function AppNavClient({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return <header className="hdr">
    <div className="wrap">
      <Link href="/" className="brand" aria-label="GoalGrid home">Goal<b>Grid</b></Link>
      <nav className="nav" aria-label="Main navigation">
        {navigation.map(([label, href]) => <Link key={href} className={active(href) ? "on" : undefined} aria-current={active(href) ? "page" : undefined} href={href}>{label}</Link>)}
        <GlobalSearch compact />
      </nav>
      <div className="sp">
        {signedIn ? <form action="/auth/signout" method="post"><button className="btn sm" type="submit">Sign out</button></form> : <Link className="btn sm p" href="/sign-in">Sign in</Link>}
      </div>
    </div>
  </header>;
}
