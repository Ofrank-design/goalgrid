import type { Viewport } from "next";
import Link from "next/link";
import "./home.css";
import { Features, Leagues } from "@/components/home/HomeStatic";
import {
  HomeProvider,
  LivePill,
  Newsletter,
  PredictionCards,
  RevealOnScroll,
  ScrollHeader,
  SearchButton,
  SearchOverlay,
  TodayMatches,
  Toast,
} from "@/components/home/HomeClient";

const CONTACT_EMAIL = "frankoduro1912@gmail.com";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

/** The public homepage. Sample fixtures render first; live ones replace them in the browser when the app has data. */
export default function Home() {
  return (
    <HomeProvider>
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true"><defs>
      <symbol id="i-chart" viewBox="0 0 24 24"><path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6" /></symbol>
      <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3 19c0-3.3 2.7-5 6-5s6 1.7 6 5M16 14c2.8 0 5 1.4 5 4" /></symbol>
      <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" /></symbol>
      <symbol id="i-wave" viewBox="0 0 24 24"><circle cx="12" cy="12" r="2" /><path d="M8 8a5.7 5.7 0 000 8M16 8a5.7 5.7 0 010 8M5 5a10 10 0 000 14M19 5a10 10 0 010 14" /></symbol>
      <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></symbol>
      <symbol id="i-brain" viewBox="0 0 24 24"><path d="M9 4a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 006 0V4a3 3 0 00-3 0zM15 4a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 2" /></symbol>
      <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 3L5 14h6l-1 7 8-11h-6z" /></symbol>
      <symbol id="i-grid" viewBox="0 0 24 24"><path d="M3 3h18v18H3zM3 9h18M9 3v18" /></symbol>
      <symbol id="i-bar" viewBox="0 0 24 24"><path d="M5 20V10M12 20V4M19 20v-7" /></symbol>
      <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></symbol><symbol id="i-tag" viewBox="0 0 24 24"><path d="M3 5v6l10 10 7-7L10 4H3zM7 8h.01" /></symbol>
      <symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></symbol>
      <symbol id="i-arr" viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></symbol>
      <symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" /></symbol>
      <symbol id="i-x" viewBox="0 0 24 24"><path d="M5 4l14 16M19 4L5 20" /></symbol>
      <symbol id="i-ig" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="3.6" /></symbol>
      <symbol id="i-yt" viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="4" /><path d="M10 9.5v5l4.5-2.5z" /></symbol>
      <symbol id="i-in" viewBox="0 0 24 24"><path d="M5 10v9M5 5.5v.1M10 19v-9M10 14c0-2.5 1.5-4 3.5-4s3.5 1.5 3.5 4v5" /></symbol>
      </defs></svg>
      <ScrollHeader><div className="wl nav">
      <Link className="logo" role="img" aria-label="GoalGrid, AI football intelligence" href="/"></Link>
      <nav className="links" aria-label="Main"><Link className="a" href="/">Home</Link><Link href="/dashboard">Matches</Link><Link href="/predictions">Predictions</Link><Link href="/leagues">Leagues</Link><Link href="/teams">Teams</Link><Link href="/pricing">Free access</Link><Link href="/accuracy">Analytics</Link><Link href="/dashboard?view=live">Live</Link></nav>
      <div className="nr"><SearchButton /><Link className="b sm g2" href="/sign-in">Sign In</Link><Link className="b sm p" href="/sign-in?mode=signup">Get Started</Link></div>
      </div></ScrollHeader>
      <SearchOverlay />
      <section className="hero lux-section" id="top"><img src="/home/hero.webp" alt="Three footballers in club kits under stadium floodlights" fetchPriority="high" />
      <div className="tag">Better Data.<br />Smarter Predictions.<br />Real Insights.</div>
      <div className="wl hc"><div className="in"><div className="eb">AI FOOTBALL INTELLIGENCE</div>
      <h1>See the Match <em>Before It Happens.</em></h1>
      <p className="lead">GoalGrid combines advanced AI, live data and multiple model consensus to deliver football predictions, analytics and insights you can trace back to evidence.</p>
      <div className="cta"><a className="b p" href="#today">Start Exploring <svg className="ic"><use href="#i-arr" /></svg></a><Link className="b" href="/dashboard?view=live"><svg className="ic"><use href="#i-play" /></svg>View Live Matches</Link></div>
      <div className="feat"><span><svg className="ic"><use href="#i-grid" /></svg>AI Predictions</span><span><svg className="ic"><use href="#i-bolt" /></svg>Real-Time Data</span><span><svg className="ic"><use href="#i-users" /></svg>Multiple Model Consensus</span><span><svg className="ic"><use href="#i-bar" /></svg>In-Depth Analytics</span></div>
      </div></div></section>
      <section className="today-home lux-section" id="today"><div className="w">
      <div className="section-head"><div><div className="eb">TODAY'S MATCHES</div><h2>What is on the pitch today.</h2><p>Follow the fixtures first. Open any match for the deeper GoalGrid view.</p><LivePill id="today-pill" liveText="Live fixtures and match centre data" /></div><Link className="b sm" href="/dashboard">View All Matches <svg className="ic"><use href="#i-arr" /></svg></Link></div>
      <TodayMatches /></div></section>
      <section className="pred lux-section" id="pred"><div className="w pg">
      <div><div className="eb">GOALGRID PREDICTIONS</div><h2>Smart probabilities.<br />Real evidence.</h2><Link className="b sm" style={{ marginTop: "22px" }} href="/predictions">Explore Predictions <svg className="ic"><use href="#i-arr" /></svg></Link><br /><LivePill id="pill" liveText="Live fixtures and model consensus" /></div>
      <PredictionCards /></div></section>
      <section className="intro lux-section" id="how-goalgrid-thinks"><div className="w ig">
      <div><div className="eb how-label">HOW GOALGRID THINKS</div><div className="logo" role="img" aria-label="GoalGrid"></div><p>We combine the power of artificial intelligence, advanced statistics and expert analysis to deliver reliable football predictions, deep team insights and comprehensive match breakdowns.</p><Leagues /></div>
      <Features />
      <div className="ph" aria-label="App preview"><div className="t"><div className="logo"></div><svg className="ic" style={{ fontSize: "11px" }}><use href="#i-search" /></svg></div>
      <h4>Arsenal vs Chelsea</h4><div className="s">Premier League, sample fixture</div>
      <div className="pm"><div className="cr im" role="img" aria-label="Arsenal" style={{ backgroundImage: "var(--c-ars)" }}></div><span style={{ color: "var(--mu)" }}>vs</span><div className="cr im" role="img" aria-label="Chelsea" style={{ backgroundImage: "var(--c-che)" }}></div></div>
      <b style={{ fontSize: "9px" }}>Match Prediction</b><div className="t3"><div>Home Win<br /><span style={{ fontSize: "13px" }}>57%</span></div><div>Draw<br /><span style={{ fontSize: "13px" }}>24%</span></div><div>Away Win<br /><span style={{ fontSize: "13px" }}>19%</span></div></div>
      <div className="s" style={{ textAlign: "left" }}>Most Likely Score</div><div className="sc">2 - 1</div><div className="vb">View Full Analysis</div>
      <div className="tb"><b>Home</b><span>Predictions</span><span>Leagues</span><span>Profile</span></div></div>
      </div></section>
      <section className="sim-home lux-section" id="simulation"><div className="w" style={{ position: "relative", overflow: "hidden", borderRadius: "28px", minHeight: "430px", background: "#08151b url('/hero/simulation.webp') center/cover no-repeat" }}><div style={{ position: "absolute", inset: "0", background: "linear-gradient(90deg,rgba(6,13,18,.96) 0%,rgba(6,13,18,.76) 45%,rgba(6,13,18,.16) 100%)" }}></div><div style={{ position: "relative", zIndex: "1", maxWidth: "610px", padding: "70px 56px" }}><div className="eb">SIMULATION LAB</div><h2 style={{ fontSize: "clamp(32px,5vw,62px)", lineHeight: "1.02", margin: "12px 0" }}>Watch the model <em>play it out.</em></h2><p style={{ color: "var(--mu)", fontSize: "17px", lineHeight: "1.7", maxWidth: "560px" }}>Choose real clubs from the Premier League, La Liga, Serie A, Bundesliga or Ligue 1. Set a hypothetical scenario, run the match and watch a synthetic football game unfold on the pitch.</p><div className="chips" style={{ marginTop: "24px" }}><Link className="b p" href="/simulation">Explore Simulation Lab <svg className="ic"><use href="#i-arr" /></svg></Link><span className="pill">Research only · Not a live match</span></div></div></div></section>
      <section className="community-home lux-section" id="community"><div className="w"><Link className="cm" data-go="the Community Center" href="/community">
      <div className="cmt"><div className="eb">COMMUNITY CENTER</div><h2>Where football <em>minds meet.</em></h2><p>Debate every fixture in live match threads, take on prediction challenges and climb a leaderboard that rewards calibrated thinking, not noise.</p>
      <div className="chips"><span>Live match threads</span><span>Prediction challenges</span><span>Weekly leaderboard</span><span>Follow top analysts</span></div>
      <span className="b p">Enter the Community Center <svg className="ic"><use href="#i-arr" /></svg></span></div>
      <div className="cmi"><img loading="lazy" src="/hero/community.webp" alt="Fans with flags in a floodlit stadium" /><div className="lbp"><h6>TOP PREDICTORS THIS WEEK<span>Sample</span></h6>
      <div className="lr"><i>1</i><span>@xg_whisperer</span><b>71%</b></div><div className="lr"><i>2</i><span>@backline_notes</span><b>68%</b></div><div className="lr"><i>3</i><span>@tacticalnine</span><b>66%</b></div></div></div>
      </Link></div></section>
      <section className="gil-home lux-section" id="game-intelligence"><div className="w"><Link className="gil-card" data-go="the Game Intelligence Lab" href="/intelligence"><div className="gilt"><div className="eb">GAME INTELLIGENCE LAB</div><h2>Go deeper into the <em>numbers behind the game.</em></h2><p>Explore distributions, streaks, anomalies, change points, verification and research tools in GoalGrid's advanced statistical workspace.</p><div className="chips"><span>Statistical research</span><span>Pattern analysis</span><span>Model experiments</span><span>Deep intelligence</span></div><span className="b p">Enter Game Intelligence Lab <svg className="ic"><use href="#i-arr" /></svg></span></div><div className="gili"><img loading="lazy" src="/hero/lounge.webp" alt="Premium stadium lounge atmosphere" /></div></Link></div></section>
      <section className="band lux-section"><div className="w"><div><h2>More Than Just Predictions.</h2><p>Every number comes with its evidence, confidence and data quality.</p></div><Link className="b p" href="/predictions">Start Exploring <svg className="ic"><use href="#i-arr" /></svg></Link></div></section>
      <footer><div className="w"><div className="ft">
      <div className="fb"><div className="logo" role="img" aria-label="GoalGrid"></div><p>AI football intelligence. Probabilities, model consensus and the evidence behind every prediction.</p>
      <div className="soc"><a target="_blank" rel="noopener noreferrer" aria-label="X" href="https://x.com/odee_frank"><img src="/social/twitter.webp" alt="" width="36" height="36" /></a><a target="_blank" rel="noopener noreferrer" aria-label="Instagram" href="https://instagram.com/_anonymoustroy"><img src="/social/instagram.webp" alt="" width="36" height="36" /></a><a target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" href="https://www.linkedin.com/in/ofrank-design/"><img src="/social/linkedin.webp" alt="" width="36" height="36" /></a><a target="_blank" rel="noopener noreferrer" aria-label="GitHub" href="https://github.com/Ofrank-design"><img src="/social/github.webp" alt="" width="36" height="36" /></a><a id="mail" aria-label="Email" href={`mailto:${CONTACT_EMAIL}`}><img src="/social/gmail.webp" alt="" width="36" height="36" /></a></div>
      <Newsletter /></div>
      <div className="col"><h6>Product</h6><Link href="/dashboard">Matches</Link><Link href="/predictions">Predictions</Link><Link href="/leagues">Leagues</Link><Link href="/teams">Teams</Link><Link href="/pricing">Free access</Link><Link href="/accuracy">Analytics</Link><Link href="/dashboard?view=live">Live</Link></div>
      <div className="col"><h6>Plans</h6><Link data-go="the Free dashboard" href="/dashboard">Free mode</Link><Link data-go="the Pro dashboard" href="/pro">Pro</Link><Link data-go="the Premium dashboard" href="/premium">Premium</Link></div>
      <div className="col"><h6>Community</h6><Link data-go="the Community Center" href="/community">Community Center</Link><Link data-go="the Leaderboard" href="/leaderboard">Leaderboard</Link><Link data-go="Challenges" href="/challenges">Challenges</Link><Link href="/notifications">Notifications</Link></div>
      <div className="col"><h6>Company</h6><Link href="/about">About</Link><Link href="/methodology">Methodology</Link><Link href="/responsible-use">Responsible use</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></div>
      </div>
      <div className="fbt"><p>© 2026 GoalGrid. All rights reserved. Predictions are probabilities, not guarantees, and can be wrong. Figures on this page are sample data. Please follow the rules where you live.</p><div className="lk"><a className="up" href="#top">Back to top ↑</a></div></div></div></footer><Toast />
      <nav className="bn" aria-label="Primary"><Link className="a" href="/"><svg className="ic"><use href="#i-home" /></svg>Home</Link><Link href="/dashboard"><svg className="ic"><use href="#i-grid" /></svg>Matches</Link><Link href="/predictions"><svg className="ic"><use href="#i-chart" /></svg>Predictions</Link><Link href="/pricing"><svg className="ic"><use href="#i-tag" /></svg>Pricing</Link></nav>
      <RevealOnScroll />
    </HomeProvider>
  );
}
