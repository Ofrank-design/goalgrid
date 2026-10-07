import { SiteHeaderClient } from "./SiteHeaderClient";
import Link from "next/link";

export function SiteHeader() {
  return <SiteHeaderClient />;
}

export function SiteBottomNav() {
  return <nav className="si-bn" aria-label="Primary">
    <Link href="/">Home</Link>
    <Link href="/dashboard">Matches</Link>
    <Link href="/community">Community</Link>
    <Link href="/pricing">Pricing</Link>
  </nav>;
}
