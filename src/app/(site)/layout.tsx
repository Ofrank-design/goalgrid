import "../globals.css";
import "@/components/site/site.css";
import { SiteBottomNav, SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <div className="si" id="si-top"><SiteHeader />{children}<SiteFooter /><SiteBottomNav /></div>;
}
