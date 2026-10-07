import Link from "next/link";
import { NewsletterForm } from "./NewsletterForm";
import { SocialIcons } from "./SocialIcons";
/** Same blocks, order and copy as the homepage footer. The Company column now links to the six information pages. */
export function SiteFooter() {
  return (
    <footer className="si-ft"><div className="si-w">
      <div className="si-fg">
        <div className="si-fb"><Link href="/" className="si-logo" aria-label="GoalGrid home"><img src="/brand/logo.webp" alt="GoalGrid" width={190} height={42} /></Link><p>AI football intelligence. Probabilities, model consensus and the evidence behind every prediction.</p><SocialIcons /><NewsletterForm /></div>
        <div className="si-col"><h6>Product</h6><Link href="/dashboard">Matches</Link><Link href="/dashboard">Predictions</Link><Link href="/leagues">Leagues</Link><Link href="/teams">Teams</Link><Link href="/pricing">Pricing</Link><Link href="/accuracy">Analytics</Link><Link href="/dashboard">Live</Link></div>
        <div className="si-col"><h6>Tools</h6><Link href="/dashboard">Matches</Link><Link href="/pro">Probability tools</Link><Link href="/premium">Research tools</Link></div>
        <div className="si-col"><h6>Community</h6><Link href="/community">Community Center</Link><Link href="/leaderboard">Leaderboard</Link><Link href="/challenges">Challenges</Link></div>
        <div className="si-col"><h6>Company</h6><Link href="/about">About</Link><Link href="/methodology">Methodology</Link><Link href="/responsible-use">Responsible use</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></div>
      </div>
      <div className="si-fbt"><p>© 2026 GoalGrid. All rights reserved. Predictions are probabilities, not guarantees, and can be wrong. Please follow the rules where you live.</p><a className="si-up" href="#si-top">Back to top ↑</a></div>
    </div></footer>
  );
}
