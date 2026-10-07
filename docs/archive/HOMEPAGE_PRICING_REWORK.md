> **Archived, not current.** Written during the build and kept for history. Several statements here are out of date. See [docs/STATUS.md](../STATUS.md) for what is true now.

# GoalGrid Homepage + Pricing Rework

Implemented:

- Homepage sequence is now: Hero → Today's Matches → GoalGrid Predictions → How GoalGrid Thinks → Simulation Lab → Community → Game Intelligence Lab → Final CTA → Footer.
- Removed the pricing plan section from the homepage.
- Added a Game Intelligence Lab homepage card using `/hero/lounge.webp`.
- Replaced `Players` with `Pricing` in the main site navigation and product footer.
- Added `/pricing` as a dedicated pricing page using the existing GoalGrid site UI contract and visual system.
- The pricing page presents Free, Pro and Premium capabilities and routes users to the existing dashboard/entitlement flows.
- Removed the old homepage tier-rendering script so the page has no dead `#t3` dependency.

Note: the current product contract does not specify monetary amounts for Pro/Premium, so the pricing page does not invent prices. It uses the existing private entitlement/access flow until commercial amounts are configured.
