import Link from "next/link";

export const metadata = {
  title: "Free access | GoalGrid",
  description: "Every GoalGrid tool is free for everyone with an account. No payments, no access codes.",
};

const groups = [
  { key: "free", label: "MATCHES", name: "Follow the football", tagline: "Understand the match.", href: "/dashboard", cta: "Open the dashboard",
    features: ["Today's matches and results", "1X2, score, BTTS and Over/Under", "Team and league pages", "Form and head-to-head context", "Community access"] },
  { key: "pro", label: "PROBABILITY", name: "Understand why", tagline: "Pro tools, free.", href: "/pro", cta: "Explore the probability tools",
    features: ["Advanced probability center", "Model comparison and expected goals", "Market versus model view", "Injury and lineup impact when verified data exists", "Simulation Lab with real clubs from five supported leagues"] },
  { key: "premium", label: "RESEARCH", name: "Explore the intelligence", tagline: "Premium tools, free.", href: "/premium", cta: "Explore the research tools",
    features: ["Full model and consensus intelligence", "Game Intelligence Lab", "Advanced experiments and model comparison", "Prediction history and movement", "Deeper simulation and research capabilities"] },
];

export default function PricingPage() {
  return (
    <main>
      <section className="si-hero" aria-labelledby="pricing-title">
        <div className="si-hero-bg" style={{ backgroundImage: "url('/hero/lounge.webp')" }} />
        <div className="si-hc">
          <div className="si-eb">FREE FOR EVERYONE</div>
          <h1 id="pricing-title">Every tool is <span style={{ color: "var(--g)" }}>free.</span></h1>
          <p className="si-lead">No payments, no subscriptions and no access codes. Create a free account and use all of GoalGrid, from today&apos;s matches to the simulation and research labs.</p>
        </div>
      </section>

      <section className="si-main pricing-main">
        <div className="si-w">
          <div className="pricing-intro">
            <div>
              <div className="si-eb">THREE LAYERS OF FOOTBALL INTELLIGENCE</div>
              <h2>One platform. All of it open.</h2>
              <p>GoalGrid still separates everyday match discovery from deeper analysis so the first screen stays easy to scan. You never need to unlock anything to go deeper.</p>
            </div>
            <div className="pricing-note">An account is needed for tools that save your work or run on your behalf. Signing up is free.</div>
          </div>

          <div className="pricing-grid">
            {groups.map((g) => (
              <article key={g.key} className={`pricing-card pricing-${g.key}`}>
                <div className="pricing-topline"><span className="pricing-label">{g.label}</span></div>
                <h3>{g.name}</h3>
                <div className="pricing-tagline">{g.tagline}</div>
                <div className="pricing-feature-title">Includes</div>
                <ul>{g.features.map((f) => <li key={f}>{f}</li>)}</ul>
                <Link className="si-b si-b.p pricing-cta" href={g.href}>{g.cta}<span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </div>

          <section className="pricing-deeper" aria-labelledby="pricing-depth-title">
            <div>
              <div className="si-eb">FAIR USE</div>
              <h2 id="pricing-depth-title">Free, with sensible limits.</h2>
              <p>Heavy tools such as simulations and model comparison are rate limited per account so the service stays fast for everyone. Simulations run up to 1,000 times per request.</p>
            </div>
          </section>

          <div className="pricing-cta-band">
            <div>
              <div className="si-eb">READY TO EXPLORE?</div>
              <h2>Create your free account.</h2>
            </div>
            <Link className="si-b si-b.p" href="/sign-in?mode=signup">Get Started <span aria-hidden="true">→</span></Link>
          </div>
        </div>
      </section>
    </main>
  );
}
